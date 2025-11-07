import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { ResultsDisplay } from './components/ResultsDisplay';
import { ProgressDisplay, ProgressStep } from './components/ProgressDisplay';
import { ErrorDisplay } from './components/ErrorDisplay';
import { DataTable } from './components/DataTable';
import { StandardizationReview } from './components/StandardizationReview';
import { OverviewLanding } from './components/OverviewLanding';
import { ClassificationsLanding } from './components/ClassificationsLanding';
import { LibraryLanding } from './components/LibraryLanding';
import { InsightsLanding } from './components/InsightsLanding';
import { standardizeData, groupData, NRMGroup, NRMElementData } from './services/geminiService';
import { BuildingIcon, DashboardIcon, ListIcon, StarIcon, UploadIcon } from './components/Icons';
import { ActivePage } from './types/navigation';

const App: React.FC = () => {
  // 0: Upload, 1: Extract, 2: Review Standardization, 3: Standardize, 4: Group
  const [activePage, setActivePage] = useState<ActivePage>('overview');
  const [currentStep, setCurrentStep] = useState<number>(0); 
  const [extractedData, setExtractedData] = useState<NRMElementData[] | null>(null);
  const [proposedStandardizations, setProposedStandardizations] = useState<Record<string, string> | null>(null);
  const [standardizedData, setStandardizedData] = useState<NRMElementData[] | null>(null);
  const [groupedData, setGroupedData] = useState<NRMGroup[] | null>(null);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  
  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.trim().replace(/\r/g, '').split('\n');
    if (lines.length < 2) return [];

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' && (i === 0 || line[i-1] !== '"')) {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
      }
      result.push(current);
      return result.map(val => {
          let cleanVal = val.trim();
          if (cleanVal.startsWith('"') && cleanVal.endsWith('"')) {
              cleanVal = cleanVal.slice(1, -1);
          }
          return cleanVal.replace(/""/g, '"');
      });
    };
    
    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => {
      if (!line.trim()) return null;
      const values = parseLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((header, i) => {
        obj[header] = values[i] || '';
      });
      return obj;
    }).filter(Boolean) as Record<string, string>[];
  };

  const handleFileProcess = useCallback(async (file: File) => {
    setIsLoading(true);
    setLoadingMessage('Parsing CSV file...');
    setProgressSteps([{ title: 'Parsing CSV file...', status: 'active' }]);
    setError(null);
    setFileName(file.name);

    try {
      const csvData = await file.text();
      if (!csvData.trim()) throw new Error('The uploaded CSV file is empty.');
      
      const parsedData = parseCSV(csvData);
      if (parsedData.length === 0) throw new Error('CSV file contains no data rows to process.');

      setExtractedData(parsedData);
      setCurrentStep(1);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `Failed to process file: ${err.message}` : 'An unknown error occurred.');
      setCurrentStep(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleProposeStandardization = useCallback(async (data: NRMElementData[]) => {
    setIsLoading(true);
    setLoadingMessage('AI is analyzing headers...');
    setProgressSteps([{ title: 'AI is analyzing headers...', status: 'active' }]);
    setError(null);
    try {
      setExtractedData(data); // Save any edits from step 1
      const headers = Array.from(new Set(data.flatMap(row => Object.keys(row))));
      const result = await standardizeData(headers);
      setProposedStandardizations(result);
      setCurrentStep(2);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `Standardization failed: ${err.message}` : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleApplyStandardization = useCallback((approvedChanges: Record<string, string>) => {
    if (!extractedData) return;
    
    const finalStandardizedData = extractedData.map(row => {
        const newRow: NRMElementData = {};
        for (const key in row) {
            const newKey = approvedChanges[key] || key;
            newRow[newKey] = row[key];
        }
        return newRow;
    });
    setStandardizedData(finalStandardizedData);
    setCurrentStep(3);
  }, [extractedData]);


  const handleGrouping = useCallback(async (data: NRMElementData[]) => {
    setIsLoading(true);
    setLoadingMessage('AI is grouping elements...');
    setProgressSteps([{ title: 'AI is grouping elements...', status: 'active' }]);
    setError(null);
    try {
      setStandardizedData(data); // Save any edits from step 3
      const result = await groupData(data);
      if (result.length === 0) {
          throw new Error("The AI model did not return any valid groupings. The data might not contain recognizable building elements.");
      }
      setGroupedData(result);
      setCurrentStep(4);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `Grouping failed: ${err.message}` : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = () => {
    setActivePage('uploads');
    setCurrentStep(0);
    setExtractedData(null);
    setStandardizedData(null);
    setProposedStandardizations(null);
    setGroupedData(null);
    setError(null);
    setIsLoading(false);
    setFileName('');
  };

  const renderUploadsContent = () => {
    if (isLoading) {
      return <ProgressDisplay progress={100} steps={progressSteps} />;
    }
    
    if (error) {
        return <ErrorDisplay error={error} onReset={handleReset} />;
    }

    switch (currentStep) {
      case 1:
        return extractedData && (
          <DataTable
            title="Step 1: Extracted CSV Data"
            description="Review and edit the raw data extracted from your CSV file. You can add, remove, or modify columns and values before proceeding."
            data={extractedData}
            onNext={handleProposeStandardization}
            onReset={handleReset}
          />
        );
      case 2:
        return proposedStandardizations && (
          <StandardizationReview
            changes={proposedStandardizations}
            onComplete={handleApplyStandardization}
            onBack={() => setCurrentStep(1)}
            onReset={handleReset}
          />
        );
      case 3:
        return standardizedData && (
          <DataTable
            title="Step 3: Standardized Data"
            description="The AI has standardized the column headers based on your review. Make any final edits before grouping."
            data={standardizedData}
            onNext={handleGrouping}
            onBack={() => setCurrentStep(2)}
            onReset={handleReset}
            showStandardizeFunctionality={true}
          />
        );
      case 4:
        return groupedData && (
          <ResultsDisplay
            groups={groupedData}
            fileName={fileName}
            onReset={handleReset}
            onBack={() => setCurrentStep(3)}
          />
        );
      default:
        return <FileUpload onFileSelect={handleFileProcess} disabled={isLoading} />;
    }
  };

  const renderPageContent = () => {
    switch (activePage) {
      case 'overview':
        return <OverviewLanding />;
      case 'uploads':
        return (
          <div className="panel">
            {renderUploadsContent()}
          </div>
        );
      case 'classifications':
        return <ClassificationsLanding />;
      case 'library':
        return <LibraryLanding />;
      case 'insights':
        return <InsightsLanding />;
      default:
        return null;
    }
  };

  const handleNavigation = (page: ActivePage) => {
    setActivePage(page);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="sidebar__logo">
            <span className="sidebar__logo-mark">NRM</span>
            <div>
              <div>BIM Grouper</div>
              <small style={{ opacity: 0.65 }}>Automation Studio</small>
            </div>
          </div>
        </div>

        <nav className="sidebar__nav">
          <button
            className={`sidebar__link ${activePage === 'overview' ? 'sidebar__link--active' : ''}`}
            type="button"
            onClick={() => handleNavigation('overview')}
          >
            <DashboardIcon />
            Overview
          </button>
          <button
            className={`sidebar__link ${activePage === 'uploads' ? 'sidebar__link--active' : ''}`}
            type="button"
            onClick={() => handleNavigation('uploads')}
          >
            <UploadIcon />
            Uploads
          </button>
          <button
            className={`sidebar__link ${activePage === 'classifications' ? 'sidebar__link--active' : ''}`}
            type="button"
            onClick={() => handleNavigation('classifications')}
          >
            <ListIcon />
            Classifications
          </button>
          <button
            className={`sidebar__link ${activePage === 'library' ? 'sidebar__link--active' : ''}`}
            type="button"
            onClick={() => handleNavigation('library')}
          >
            <BuildingIcon />
            NRM Library
          </button>
          <button
            className={`sidebar__link ${activePage === 'insights' ? 'sidebar__link--active' : ''}`}
            type="button"
            onClick={() => handleNavigation('insights')}
          >
            <StarIcon />
            Insights
          </button>
        </nav>

        <div className="sidebar__section">
          <div className="sidebar__section-label">recent runs</div>
          <button className="sidebar__link" type="button">
            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>•</span>
            March 2025 Schedule
          </button>
          <button className="sidebar__link" type="button">
            <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>•</span>
            Hospital West Project
          </button>
        </div>

        <div className="sidebar__footer">
          <div className="sidebar__footer-title">Need help?</div>
          <div className="sidebar__footer-copy">Explore best practices for NRM alignment and schedule preparation.</div>
          <button className="sidebar__footer-button" type="button">View guide</button>
        </div>
      </aside>

      <div className="shell-main">
        <Header activePage={activePage} currentStep={currentStep} onReset={handleReset} />
        <main className="main-content">
          {renderPageContent()}
          <footer className="footer">
            Powered by Gemini 2.5 Pro · Securely processes CSV schedules
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;
