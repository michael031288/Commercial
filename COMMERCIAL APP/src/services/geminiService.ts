import { GoogleGenAI, Type } from "@google/genai";

const createClient = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("Gemini API key is missing. Set VITE_GEMINI_API_KEY in your environment.");
    }
    return new GoogleGenAI({ apiKey });
};

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractStatus = (error: unknown): number | undefined => {
    if (!error || typeof error !== 'object') return undefined;
    const candidate = error as { status?: number; response?: { status?: number }; cause?: { status?: number } };
    return candidate.status ?? candidate.response?.status ?? candidate.cause?.status;
};

const formatFriendlyMessage = (status: number | undefined, fallback: string): string => {
    switch (status) {
        case 429:
            return 'The Gemini service is receiving too many requests right now. Please wait a moment and try again.';
        case 503:
            return 'The Gemini service is temporarily unavailable. Please retry in a few moments.';
        default:
            return fallback;
    }
};

const withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            const status = extractStatus(error);
            const shouldRetry = status === 429 || status === 503;
            if (!shouldRetry || attempt === MAX_RETRIES - 1) {
                const fallbackMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                throw new Error(formatFriendlyMessage(status, fallbackMessage));
            }
            await delay(INITIAL_BACKOFF_MS * (attempt + 1));
        }
    }

    throw lastError instanceof Error ? lastError : new Error('An unknown error occurred.');
};

export interface NRMElementData {
    [key: string]: string;
}

export interface NRMElement {
    summaryText: string;
    originalRowData: NRMElementData;
}

export interface NRMGroup {
    nrmSection: string;
    elements: NRMElement[];
}

// Internal types for raw API responses
interface RawAIElement {
    summaryText: string;
    originalRowData: { key: string; value: string }[];
}

interface RawAIGroup {
    nrmSection: string;
    elements: RawAIElement[];
}

interface RawHeaderMapping {
    key: string;
    value: string;
}

const CHUNK_SIZE = 500; // Rows per parallel AI agent

const decodeBase64 = (value: string): string => {
    try {
        if (typeof value !== 'string') return String(value);
        
        // Convert Base64 string to a Uint8Array
        const binaryString = atob(value);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Use TextDecoder to decode the bytes as UTF-8, which is robust against multi-byte characters.
        const decoder = new TextDecoder('utf-8');
        let decodedUtf8 = decoder.decode(bytes);

        // Normalize superscript characters as previously requested.
        decodedUtf8 = decodedUtf8.replace(/²/g, '2').replace(/³/g, '3');
        // WORKAROUND: Fix common character encoding issues where hyphens/dashes are misinterpreted as pound signs.
        decodedUtf8 = decodedUtf8.replace(/£/g, '-');
        
        return decodedUtf8;
    } catch (e) {
        console.warn(`Failed to decode Base64 value. This might happen with malformed data. Value:`, value, e);
        // Fallback for safety, though the new method should be very reliable.
        if (typeof value === 'string') {
          return value.replace(/²/g, '2').replace(/³/g, '3').replace(/£/g, '-');
        }
        return String(value);
    }
};

const processInChunks = async <T, R>(
    data: T[], 
    processChunk: (chunk: T[]) => Promise<R[]>
): Promise<R[]> => {
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
    const chunkPromises = Array.from({ length: totalChunks }, (_, i) => {
        const start = i * CHUNK_SIZE;
        const end = start + CHUNK_SIZE;
        return processChunk(data.slice(start, end));
    });

    const chunkResults = await Promise.all(chunkPromises);
    return chunkResults.flat();
};

export async function standardizeData(headers: string[]): Promise<Record<string, string>> {
    const ai = createClient();

    const prompt = `
        You are an expert in Building Information Modeling (BIM) data schemas. Your task is to standardize a list of column headers from a BIM schedule.
        1.  Analyze the provided list of headers.
        2.  For each header, determine a standardized, common name. For example:
            - "Base Constraint" or "Reference Level" should become "Level".
            - "Family and Type" or "Element Type" should become "Type".
            - "Unconnected Height" should become "Height".
        3.  If a header is already standard or its meaning is unclear, return it unchanged.
        4.  Provide the output as a simple JSON mapping of the original header to the proposed standardized header.
        5.  **CRITICAL:** To prevent JSON parsing errors, ensure all strings in your JSON output are properly escaped.
        
        Here are the headers to process:
        ---
        ${JSON.stringify(headers)}
        ---
    `;
    const response = await withRetry(() => ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            thinkingConfig: { thinkingBudget: 8192 }, // Reduced budget as task is simpler
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    headerMap: {
                        type: Type.ARRAY,
                        description: "An array of key-value pairs mapping original headers to standardized headers.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                key: { type: Type.STRING, description: 'The original header.' },
                                value: { type: Type.STRING, description: 'The proposed standardized header.' }
                            },
                            required: ['key', 'value']
                        }
                    }
                },
                required: ['headerMap']
            }
        }
    }));

    try {
        const jsonResponse: { headerMap: RawHeaderMapping[] } = JSON.parse(response.text);
        return (jsonResponse.headerMap || []).reduce((acc, { key, value }) => {
            acc[key] = value;
            return acc;
        }, {} as Record<string, string>);
    } catch (error) {
        console.error("Error during standardization proposal:", error);
        throw error instanceof Error ? error : new Error("An unknown error occurred during standardization proposal.");
    }
}

export async function groupData(data: NRMElementData[]): Promise<NRMGroup[]> {
    const ai = createClient();
    
    const processChunk = async (chunk: NRMElementData[]): Promise<NRMGroup[]> => {
        const prompt = `
            You are an expert Quantity Surveyor specializing in RICS NRM 2. Your task is to analyze JSON data of building elements and categorize them into NRM 2 work sections.
            RULES:
            1.  Group elements into the most appropriate NRM 2 work sections (e.g., "Work Section 11: In-situ concrete works").
            2.  If an element cannot be categorized, group it under "Miscellaneous / Uncategorized".
            3.  For each element, create a concise, human-readable 'summaryText'.
            4.  The 'originalRowData' MUST be an array of objects, where each object has a 'key' (the original header) and a 'value' (the original cell value).
            5.  **CRITICAL RULE:** To prevent JSON parsing errors, ALL string values in your response (including nrmSection, summaryText, key, and value) MUST be Base64 encoded.
            6.  Your response MUST be a single, valid JSON object that conforms to the provided schema.

            Here is the standardized data chunk to process:
            ---
            ${JSON.stringify(chunk)}
            ---
        `;
        
        const response = await withRetry(() => ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                thinkingConfig: { thinkingBudget: 32768 },
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        groups: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    nrmSection: { type: Type.STRING, description: "The Base64 encoded name of the NRM 2 work section." },
                                    elements: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                summaryText: { type: Type.STRING, description: "A Base64 encoded concise summary of the element." },
                                                originalRowData: { 
                                                    type: Type.ARRAY,
                                                    description: "An array of key-value pairs representing the original data for the element.",
                                                    items: {
                                                        type: Type.OBJECT,
                                                        properties: {
                                                            key: { type: Type.STRING, description: "The Base64 encoded original column header." },
                                                            value: { type: Type.STRING, description: "The Base64 encoded original cell value." }
                                                        },
                                                        required: ['key', 'value']
                                                    }
                                                }
                                            },
                                            required: ['summaryText', 'originalRowData']
                                        }
                                    }
                                },
                                required: ['nrmSection', 'elements']
                            }
                        }
                    },
                    required: ['groups']
                }
            }
        }));
        
        const jsonResponse: { groups: RawAIGroup[] } = JSON.parse(response.text);

        return (jsonResponse.groups || []).map(group => ({
            nrmSection: decodeBase64(group.nrmSection),
            elements: group.elements.map(element => {
                const transformedOriginalRowData = (element.originalRowData || []).reduce((acc, kvp) => {
                    acc[decodeBase64(kvp.key)] = decodeBase64(kvp.value);
                    return acc;
                }, {} as NRMElementData);

                return {
                    summaryText: decodeBase64(element.summaryText),
                    originalRowData: transformedOriginalRowData,
                };
            })
        }));
    };
    
    try {
        const chunkResults = await processInChunks(data, processChunk);
        
        // Merge results from all chunks
        const mergedGroups = new Map<string, NRMElement[]>();
        for (const group of chunkResults) {
            const existing = mergedGroups.get(group.nrmSection) || [];
            mergedGroups.set(group.nrmSection, [...existing, ...group.elements]);
        }
        
        return Array.from(mergedGroups.entries(), ([nrmSection, elements]) => ({
            nrmSection,
            elements,
        })).sort((a, b) => a.nrmSection.localeCompare(b.nrmSection));

    } catch (error) {
        console.error("Error calling Gemini API for grouping:", error);
        let message = "Failed to get a response from the AI model.";
        if (error instanceof SyntaxError) {
             message = `The AI model returned an invalid format. Please try again.`;
        } else if (error instanceof Error) {
            message = error.message;
        }
        throw new Error(`${message}\n${error.toString()}`);
    }
}