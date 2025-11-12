import React, { useEffect, useRef, useState } from 'react';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import * as THREE from 'three';

interface IFCViewerProps {
  fragmentsUrl?: string;
  ifcUrl?: string;
  onElementClick?: (fragmentId: string, properties: Record<string, any>) => void;
  onElementRightClick?: (fragmentId: string, properties: Record<string, any>) => void;
  highlightedElements?: string[];
  containerStyle?: React.CSSProperties;
}

export const IFCViewer: React.FC<IFCViewerProps> = ({
  fragmentsUrl,
  ifcUrl,
  onElementClick,
  onElementRightClick,
  highlightedElements = [],
  containerStyle
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const componentsRef = useRef<OBC.Components | null>(null);
  const worldRef = useRef<OBC.World | null>(null);
  const sceneRef = useRef<OBC.SimpleScene | null>(null); // Store scene directly to avoid getter issues
  const cameraRef = useRef<OBC.SimpleCamera | null>(null); // Store camera directly to avoid getter issues
  const fragmentsRef = useRef<FRAGS.FragmentsModels | null>(null);
  const loadedUrlRef = useRef<string | null>(null); // Track what we've loaded to prevent re-loading
  const isLoadingRef = useRef<boolean>(false); // Track loading state to prevent race conditions
  const componentsInitRef = useRef<Promise<void> | null>(null); // Track components initialization
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize ThatOpen Components
    const components = new OBC.Components();
    componentsRef.current = components;

    const worlds = components.get(OBC.Worlds);
    const world = worlds.create();
    worldRef.current = world;

    // Setup scene
    const scene = new OBC.SimpleScene(components);
    sceneRef.current = scene;
    world.scene = scene;
    scene.setup();
    scene.three.background = null;

    world.renderer = new OBC.SimpleRenderer(components, containerRef.current);
    const camera = new OBC.SimpleCamera(components);
    cameraRef.current = camera;
    world.camera = camera;
    
    // Initialize components - this might be async
    const initPromise = Promise.resolve(components.init());
    componentsInitRef.current = initPromise;
    
    // Initialize Fragments using FragmentsModels (as per ThatOpen documentation)
    // Use local worker file to avoid CORS issues
    const workerUrl = '/fragments-worker.mjs';
    const fragments = new FRAGS.FragmentsModels(workerUrl);
    fragmentsRef.current = fragments;

    // When a model is loaded, configure it and add to scene
    // Register this immediately so it works even if models load before init completes
    fragments.models.list.onItemSet.add(({ value: model }) => {
      const currentCamera = cameraRef.current;
      const currentScene = sceneRef.current;
      if (model && currentCamera && currentCamera.three && currentScene && currentScene.three) {
        try {
          // Tell fragments which camera to use for culling and LOD operations
          model.useCamera(currentCamera.three);
          // Add the model to the 3D scene - use mesh property (as per fragments API)
          const meshToAdd = model.mesh || model.object;
          if (meshToAdd) {
            currentScene.three.add(meshToAdd);
            // Update fragments so the model can be seen given the initial camera position
            fragments.update(true);
            console.log('✅ Model added to scene successfully', { modelId: model.modelId });
          } else {
            console.warn('Model has no mesh or object property:', model);
          }
        } catch (err) {
          console.error('Error adding model to scene:', err);
        }
      } else {
        console.warn('Model loaded but camera or scene not ready:', {
          model: !!model,
          camera: !!currentCamera,
          cameraThree: !!currentCamera?.three,
          scene: !!currentScene,
          sceneThree: !!currentScene?.three
        });
      }
    });
    
    // Wait for initialization to complete, then setup camera and event listeners
    initPromise.then(() => {
      // Setup camera controls after initialization
      try {
        if (camera && camera.controls) {
          camera.controls.setLookAt(10, 10, 10, 0, 0, 0);
        }
      } catch (err) {
        console.error('Error setting up camera:', err);
      }

      // Update fragments on camera rest (for culling and LOD) - only after init
      try {
        if (camera && camera.controls) {
          camera.controls.addEventListener('rest', () => {
            fragments.update(true);
          });
        }
      } catch (err) {
        console.error('Error setting up camera rest listener:', err);
      }
    }).catch((err) => {
      console.error('Error initializing components:', err);
    });

    // Handle clicks on fragments
    const handleClick = (event: MouseEvent) => {
      // Check if camera and scene are initialized
      const camera = cameraRef.current;
      const scene = sceneRef.current;
      if (!camera || !camera.three) return;
      if (!scene || !scene.three) return;
      if (!fragments || !fragments.models.list) return;

      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera.three);
      const intersects = raycaster.intersectObjects(scene.three.children, true);
      
      if (intersects.length > 0) {
        const intersect = intersects[0];
        const object = intersect.object;
        
        // Find fragment model from object
        for (const model of Array.from(fragments.models.list)) {
          if (model.mesh === object || (model.mesh.children && model.mesh.children.includes(object))) {
            const fragmentId = model.modelId || String(intersect.faceIndex);
            const properties: Record<string, any> = {};
            
            // Try to get properties from fragment model
            if (model.properties) {
              Object.assign(properties, model.properties);
            }
            
            if (event.button === 2 && onElementRightClick) {
              event.preventDefault();
              onElementRightClick(fragmentId, properties);
            } else if (event.button === 0 && onElementClick) {
              onElementClick(fragmentId, properties);
            }
            break;
          }
        }
      }
    };

    containerRef.current.addEventListener('click', handleClick);
    containerRef.current.addEventListener('contextmenu', handleClick);

    // Cleanup
    return () => {
      containerRef.current?.removeEventListener('click', handleClick);
      containerRef.current?.removeEventListener('contextmenu', handleClick);
      
      cameraRef.current = null;
      sceneRef.current = null;
      
      if (world) {
        worlds.dispose([world]);
      }
      if (components) {
        components.dispose();
      }
      if (fragments) {
        // Dispose all models
        const modelIds = Array.from(fragments.models.list).map(m => m.modelId);
        modelIds.forEach(id => fragments.disposeModel(id));
      }
    };
  }, []);

  // Load fragments file or convert IFC to fragments
  useEffect(() => {
    // Determine which URL to use (prioritize fragmentsUrl)
    const urlToLoad = fragmentsUrl || ifcUrl;
    
    // Skip if no URL, already loading, or already loaded this exact URL
    if (!urlToLoad || isLoadingRef.current || loadedUrlRef.current === urlToLoad) return;
    
    // Ensure fragments and world are initialized
    if (!fragmentsRef.current || !worldRef.current) return;
    
    const loadModel = async () => {
      // Double-check we're not already loading or this URL is already loaded
      if (isLoadingRef.current || loadedUrlRef.current === urlToLoad) return;
      
      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      loadedUrlRef.current = urlToLoad; // Mark as loading/loaded immediately to prevent duplicate loads

      try {
        const fragments = fragmentsRef.current!;
        const world = worldRef.current!;

        // Wait for components to initialize first
        if (componentsInitRef.current) {
          try {
            await componentsInitRef.current;
          } catch (err) {
            console.warn('Components initialization had errors:', err);
          }
        }

        // Wait for camera to be ready (with timeout)
        // Use cameraRef directly instead of world.camera getter
        let cameraReady = false;
        let cameraThree: THREE.Camera | null = null;
        let attempts = 0;
        const maxAttempts = 50; // 5 seconds max wait
        
        while (!cameraReady && attempts < maxAttempts) {
          const camera = cameraRef.current;
          if (camera) {
            // Try to access the three property safely
            try {
              if (camera.three) {
                cameraThree = camera.three;
                cameraReady = true;
              } else {
                // Camera exists but three might not be ready yet
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
              }
            } catch (err) {
              // Camera.three might throw if not ready
              await new Promise(resolve => setTimeout(resolve, 100));
              attempts++;
            }
          } else {
            // Camera ref not set yet
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
        }

        if (!cameraReady || !cameraThree) {
          throw new Error('Camera not initialized after waiting');
        }

        if (fragmentsUrl) {
          // Load pre-converted fragments file
          console.log('Loading fragments file:', fragmentsUrl);
          
          const file = await fetch(fragmentsUrl);
          const buffer = await file.arrayBuffer();
          
          // Extract model ID from filename
          const modelId = fragmentsUrl.split('/').pop()?.split('.').shift() || 'model';
          
          // Load fragments model with camera (as per ThatOpen documentation)
          await fragments.load(buffer, { 
            modelId,
            camera: cameraThree 
          });
          
          console.log('✅ Fragments model loaded successfully');
        } else if (ifcUrl) {
          // Convert IFC to fragments using IfcImporter (as per ThatOpen documentation)
          console.log('Converting IFC to fragments:', ifcUrl);
          
          // Fetch IFC file
          const ifcFile = await fetch(ifcUrl);
          const ifcBuffer = await ifcFile.arrayBuffer();
          const typedArray = new Uint8Array(ifcBuffer);
          
          // Create IfcImporter
          const serializer = new FRAGS.IfcImporter();
          serializer.wasm = {
            absolute: true,
            path: 'https://unpkg.com/web-ifc@0.0.72/',
          };
          
          // Process IFC file to fragments
          const bytes = await serializer.process({ bytes: typedArray, raw: true });
          
          // Extract model ID from filename
          const modelId = ifcUrl.split('/').pop()?.split('.').shift() || `model-${Date.now()}`;
          
          // Load fragments with camera (as per ThatOpen documentation)
          await fragments.load(bytes, {
            modelId,
            camera: cameraThree,
            raw: true,
          });
          
          // Model is automatically added to scene via onItemSet listener
          console.log('✅ IFC converted to fragments and loaded successfully');
        }
        
        // Update fragments to render
        fragments.update(true);
        
        // Set camera position
        const camera = cameraRef.current;
        if (camera && camera.controls) {
          camera.controls.setLookAt(10, 10, 10, 0, 0, 0);
        }
      } catch (err) {
        console.error('Error loading model:', err);
        setError(err instanceof Error ? err.message : 'Failed to load model');
        loadedUrlRef.current = null; // Reset on error to allow retry
      } finally {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    };

    loadModel();
  }, [fragmentsUrl, ifcUrl]); // Removed isLoading from dependencies to prevent infinite loop

  // Handle highlighting
  useEffect(() => {
    if (!fragmentsRef.current || !worldRef.current) return;
    
    const fragments = fragmentsRef.current;
    const models = fragments.models.list;

    // Reset all highlights (simplified - in production you'd want to restore original materials)
    for (const model of Array.from(models)) {
      // Reset logic would go here
    }

    // Highlight selected elements
    if (highlightedElements.length > 0) {
      for (const model of Array.from(models)) {
        const fragmentId = model.modelId || '';
        if (highlightedElements.includes(fragmentId)) {
          const highlightMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            emissive: 0x004400,
            emissiveIntensity: 0.5,
          });
          
          // Apply highlight material
          if (model.mesh) {
            model.mesh.traverse((child) => {
              if (child instanceof THREE.Mesh) {
                child.material = highlightMaterial;
              }
            });
          }
        }
      }
      
      // Update fragments to render highlights
      fragments.update(true);
    }
  }, [highlightedElements]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...containerStyle }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          borderRadius: '8px'
        }}>
          Loading fragments...
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          padding: '10px',
          backgroundColor: 'rgba(255, 0, 0, 0.8)',
          color: 'white',
          borderRadius: '4px'
        }}>
          Error: {error}
        </div>
      )}
    </div>
  );
};
