/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  RotateCcw, Info, Trophy, Layout, Eye, EyeOff, Code, FileText, CheckCircle2, 
  Target, ChevronRight, Sparkles, Wand2, RefreshCw, ZoomIn, ZoomOut, Compass, HelpCircle 
} from 'lucide-react';
import { 
  Vector3D, Matrix4x4, TransformSettings, DisplayOptions, ShapeType 
} from './types';
import { MODELS, getNormalizationParams, normalizeVertices, generateOBJText } from './utils/geometry';
import { identity, getTRS, multiply, fmt } from './utils/matrix';
import { CHALLENGES, Challenge } from './utils/challenges';
import { worldToView, projectToScreen, getBoundingBoxCorners, BOX_EDGES, Camera } from './utils/projection';

export default function App() {
  // Model settings
  const [activeShape, setActiveShape] = useState<ShapeType>('cube');
  const [showObjPreview, setShowObjPreview] = useState(false);

  // Target values (Transform slider controls)
  const defaultSettings: TransformSettings = {
    localTranslation: { x: 0, y: 0, z: 0 },
    localRotation: { x: 0, y: 0, z: 0 },
    localScale: { x: 1, y: 1, z: 1 },
    worldTranslation: { x: 0, y: 0, z: 0 },
    worldRotation: { x: 0, y: 0, z: 0 },
    worldScale: { x: 1, y: 1, z: 1 },
  };

  const [settings, setSettings] = useState<TransformSettings>(defaultSettings);

  // Visual options
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    showBoundingBox: true,
    showAxes: true,
    showCenter: true,
    showMatrixMath: true,
    projection: 'perspective',
    showVertexLabels: false,
  });

  // Display/Interact options
  const [showLocalAxes, setShowLocalAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // Camera Settings (Orbital)
  const [camera, setCamera] = useState<Camera>({
    angleX: -35,
    angleY: 20,
    distance: 4.5,
    fov: 2.2,
    projection: 'perspective',
  });

  // Challenge Mode State
  const [challengeMode, setChallengeMode] = useState(false);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [challengeScore, setChallengeScore] = useState(0);
  const [challengeSuccess, setChallengeSuccess] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Drag rotation state for 3D Orbit camera
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragAngleStart = useRef({ x: 0, y: 0 });

  // Canvas element reference & width/height bounds
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 480 });

  // Active challenge reference
  const currentChallenge = CHALLENGES[challengeIndex];

  // If Challenge Mode is activated, make sure model matches challenge goal
  useEffect(() => {
    if (challengeMode && currentChallenge) {
      setActiveShape(currentChallenge.targetShape);
      // Reset score checking
      setChallengeSuccess(false);
      setShowHint(false);
    }
  }, [challengeMode, challengeIndex]);

  // Handle ResizeObserver to update Canvas dimensions dynamically without distortion
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({
          width: Math.max(width, 300),
          height: Math.max(height ? height - 10 : 420, 320),
        });
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute transform matrices
  const { mLocal, mWorld, mCombined } = useMemo(() => {
    const l = settings.localTranslation;
    const lr = settings.localRotation;
    const ls = settings.localScale;

    const w = settings.worldTranslation;
    const wr = settings.worldRotation;
    const ws = settings.worldScale;

    const mL = getTRS(l, lr, ls);
    const mW = getTRS(w, wr, ws);
    const mC = multiply(mW, mL);

    return { mLocal: mL, mWorld: mW, mCombined: mC };
  }, [settings]);

  // Compute matrices for the target challenge (Ghost Object)
  const { mTargetCombined, targetNormalizedVerts, targetModel } = useMemo(() => {
    if (!challengeMode || !currentChallenge) {
      return { mTargetCombined: identity(), targetNormalizedVerts: [], targetModel: MODELS.cube };
    }
    const tModel = MODELS[currentChallenge.targetShape];
    const tNormParams = getNormalizationParams(tModel.rawVertices);
    const tNormVerts = normalizeVertices(tModel.rawVertices, tNormParams);

    const l = currentChallenge.targetSettings.localTranslation;
    const lr = currentChallenge.targetSettings.localRotation;
    const ls = currentChallenge.targetSettings.localScale;

    const w = currentChallenge.targetSettings.worldTranslation;
    const wr = currentChallenge.targetSettings.worldRotation;
    const ws = currentChallenge.targetSettings.worldScale;

    const mL = getTRS(l, lr, ls);
    const mW = getTRS(w, wr, ws);
    const mC = multiply(mW, mL);

    return { mTargetCombined: mC, targetNormalizedVerts: tNormVerts, targetModel: tModel };
  }, [challengeMode, challengeIndex, currentChallenge]);

  // Model parameters (either user model or challenge model)
  const activeModel = MODELS[activeShape] || MODELS.cube;
  const normParams = getNormalizationParams(activeModel.rawVertices);
  const normalizedVertices = normalizeVertices(activeModel.rawVertices, normParams);

  // Evaluate interactive mouse-drag for rotating viewport
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragAngleStart.current = { x: camera.angleX, y: camera.angleY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    
    // Smooth orbit movement
    setCamera((prev) => ({
      ...prev,
      angleX: dragAngleStart.current.x + dx * 0.4,
      angleY: Math.max(-85, Math.min(85, dragAngleStart.current.y + dy * 0.4)),
    }));
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Reset Transformations helper
  const handleResetTransforms = () => {
    setSettings(defaultSettings);
    setChallengeSuccess(false);
  };

  // Reset view helper
  const handleResetCamera = () => {
    setCamera({
      angleX: -35,
      angleY: 20,
      distance: 4.5,
      fov: 2.2,
      projection: displayOptions.projection,
    });
  };

  // Change specific transform slider properties
  const updateTransform = (
    space: 'localTranslation' | 'localRotation' | 'localScale' | 'worldTranslation' | 'worldRotation' | 'worldScale',
    axis: 'x' | 'y' | 'z',
    value: number
  ) => {
    setSettings((prev) => ({
      ...prev,
      [space]: {
        ...prev[space],
        [axis]: value,
      },
    }));
  };

  // Trigger automatic validation matching of vertices
  const matchPercentage = useMemo(() => {
    if (!challengeMode || !currentChallenge || !normalizedVertices || !targetNormalizedVerts) return 0;
    
    // Compare current state normalizedVertices transformed by mCombined
    // with targetNormalizedVerts transformed by mTargetCombined
    let totalDist = 0;
    const count = normalizedVertices.length;
    const targetCount = targetNormalizedVerts.length;
    
    // Guard against temporary state mismatch during model/challenge transitions
    if (count === 0 || count !== targetCount) return 0;
    
    for (let i = 0; i < count; i++) {
      // User transformed vertex
      const userRaw = normalizedVertices[i];
      if (!userRaw) continue;
      const pUser = worldToLocalAndWorld(userRaw, mCombined);

      // Target transformed vertex
      const targetRaw = targetNormalizedVerts[i];
      if (!targetRaw) continue;
      const pTarget = worldToLocalAndWorld(targetRaw, mTargetCombined);

      if (!pUser || !pTarget) continue;

      const dx = pUser[0] - pTarget[0];
      const dy = pUser[1] - pTarget[1];
      const dz = pUser[2] - pTarget[2];

      totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    const avgDist = totalDist / count;
    // Scale score: avgDist around 0 is 100%, avgDist >= 1.5 is 0%.
    const rawScore = Math.max(0, 100 * (1 - avgDist / 1.8));
    const scoreIdx = Math.round(rawScore);

    // If matching coefficients are tight, snap to 100
    if (scoreIdx >= 96) {
      return 100;
    }
    return scoreIdx;
  }, [challengeMode, currentChallenge, settings, mCombined, mTargetCombined, normalizedVertices, targetNormalizedVerts]);

  // Auto detect score for user satisfaction
  useEffect(() => {
    if (challengeMode) {
      setChallengeScore(matchPercentage);
      if (matchPercentage === 100) {
        setChallengeSuccess(true);
      }
    }
  }, [matchPercentage, challengeMode]);

  // Assist with matching setup automatically (Sandbox play)
  const handleSolveChallenge = () => {
    if (challengeMode && currentChallenge) {
      setSettings(currentChallenge.targetSettings);
      setChallengeSuccess(true);
    }
  };

  function worldToLocalAndWorld(V: Vector3D, M: Matrix4x4): Vector3D {
    // Treat homogeneous [x,y,z,1]^T
    const x = V[0];
    const y = V[1];
    const z = V[2];
    
    const rx = M[0][0] * x + M[0][1] * y + M[0][2] * z + M[0][3] * 1;
    const ry = M[1][0] * x + M[1][1] * y + M[1][2] * z + M[1][3] * 1;
    const rz = M[2][0] * x + M[2][1] * y + M[2][2] * z + M[2][3] * 1;
    const rw = M[3][0] * x + M[3][1] * y + M[3][2] * z + M[3][3] * 1;

    if (Math.abs(rw) > 0.0001 && Math.abs(rw - 1) > 0.0001) {
      return [rx / rw, ry / rw, rz / rw];
    }
    return [rx, ry, rz];
  }

  // Draw code loop inside HTML Canvas API
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSize;
    ctx.clearRect(0, 0, width, height);

    // Canvas Background paint
    ctx.fillStyle = '#060606'; // Matte deep black
    ctx.fillRect(0, 0, width, height);

    // Apply projection configuration to camera
    const cameraWithProj = {
      ...camera,
      projection: displayOptions.projection,
    };

    // 1. Draw Ground Reference Grid in XZ World plane centered around origin
    if (showGrid) {
      ctx.strokeStyle = '#1e1e1e'; // Elegant dark grey grid
      ctx.lineWidth = 1;
      
      const gridCount = 6;
      const step = 0.5;
      
      for (let i = -gridCount; i <= gridCount; i++) {
        // Line along Z (X = const)
        const p1: Vector3D = [i * step, 0, -gridCount * step];
        const p2: Vector3D = [i * step, 0, gridCount * step];

        const vView1 = worldToView(p1, cameraWithProj);
        const vView2 = worldToView(p2, cameraWithProj);

        const sc1 = projectToScreen(vView1, width, height, cameraWithProj);
        const sc2 = projectToScreen(vView2, width, height, cameraWithProj);

        if (sc1 && sc2) {
          ctx.beginPath();
          ctx.moveTo(sc1[0], sc1[1]);
          ctx.lineTo(sc2[0], sc2[1]);
          ctx.stroke();
        }

        // Line along X (Z = const)
        const p3: Vector3D = [-gridCount * step, 0, i * step];
        const p4: Vector3D = [gridCount * step, 0, i * step];

        const vView3 = worldToView(p3, cameraWithProj);
        const vView4 = worldToView(p4, cameraWithProj);

        const sc3 = projectToScreen(vView3, width, height, cameraWithProj);
        const sc4 = projectToScreen(vView4, width, height, cameraWithProj);

        if (sc3 && sc4) {
          ctx.beginPath();
          ctx.moveTo(sc3[0], sc3[1]);
          ctx.lineTo(sc4[0], sc4[1]);
          ctx.stroke();
        }
      }
    }

    // 2. Draw World Axes
    if (displayOptions.showAxes) {
      const axisLen = 1.2;
      const origin: Vector3D = [0, 0, 0];
      const axX: Vector3D = [axisLen, 0, 0];
      const axY: Vector3D = [0, axisLen, 0];
      const axZ: Vector3D = [0, 0, axisLen];

      const scOr = projectToScreen(worldToView(origin, cameraWithProj), width, height, cameraWithProj);
      const scX = projectToScreen(worldToView(axX, cameraWithProj), width, height, cameraWithProj);
      const scY = projectToScreen(worldToView(axY, cameraWithProj), width, height, cameraWithProj);
      const scZ = projectToScreen(worldToView(axZ, cameraWithProj), width, height, cameraWithProj);

      if (scOr) {
        // X axis (Red)
        if (scX) {
          ctx.strokeStyle = '#ef4444'; // Red-500
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(scOr[0], scOr[1]);
          ctx.lineTo(scX[0], scX[1]);
          ctx.stroke();

          ctx.fillStyle = '#f87171';
          ctx.font = '10px monospace';
          ctx.fillText('+X (World)', scX[0] + 4, scX[1] + 2);
        }

        // Y axis (Green)
        if (scY) {
          ctx.strokeStyle = '#22c55e'; // Green-500
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(scOr[0], scOr[1]);
          ctx.lineTo(scY[0], scY[1]);
          ctx.stroke();

          ctx.fillStyle = '#4ade80';
          ctx.font = '10px monospace';
          ctx.fillText('+Y (World)', scY[0] - 15, scY[1] - 6);
        }

        // Z axis (Blue)
        if (scZ) {
          ctx.strokeStyle = '#3b82f6'; // Blue-500
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(scOr[0], scOr[1]);
          ctx.lineTo(scZ[0], scZ[1]);
          ctx.stroke();

          ctx.fillStyle = '#60a5fa';
          ctx.font = '10px monospace';
          ctx.fillText('+Z (World)', scZ[0] + 4, scZ[1] + 2);
        }
      }
    }

    // 3. Draw Challenge Target Template (Ghost silhouette structure)
    if (challengeMode && currentChallenge) {
      // Compute target points
      const targetTransformedPoints = targetNormalizedVerts.map(v => 
        worldToLocalAndWorld(v, mTargetCombined)
      );

      const targetScreenPoints = targetTransformedPoints.map(v => 
        projectToScreen(worldToView(v, cameraWithProj), width, height, cameraWithProj)
      );

      // Draw ghost faces fill
      targetModel.faces.forEach((face) => {
        ctx.beginPath();
        let valid = false;
        face.forEach((vIdx, index) => {
          const pt = targetScreenPoints[vIdx];
          if (pt) {
            if (index === 0) {
              ctx.moveTo(pt[0], pt[1]);
              valid = true;
            } else {
              ctx.lineTo(pt[0], pt[1]);
            }
          }
        });
        if (valid) {
          ctx.closePath();
          // Transparent emerald-cyan tint for matching
          ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
          ctx.fill();
        }
      });

      // Draw ghost edges
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)'; // Soft glowing emerald
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]); // Dashed edges
      
      targetModel.edges.forEach(([i, j]) => {
        const pt1 = targetScreenPoints[i];
        const pt2 = targetScreenPoints[j];
        if (pt1 && pt2) {
          ctx.beginPath();
          ctx.moveTo(pt1[0], pt1[1]);
          ctx.lineTo(pt2[0], pt2[1]);
          ctx.stroke();
        }
      });
      ctx.setLineDash([]); // clear dash

      // Target centers
      const targetCenterWorld = worldToLocalAndWorld([0, 0, 0], mTargetCombined);
      const scTargetCenter = projectToScreen(worldToView(targetCenterWorld, cameraWithProj), width, height, cameraWithProj);
      if (scTargetCenter) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(scTargetCenter[0], scTargetCenter[1], 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6ee7b7';
        ctx.font = '9px monospace';
        ctx.fillText('Target Center', scTargetCenter[0] + 8, scTargetCenter[1] - 4);
      }
    }

    // 4. Calculate user transformed points
    const transformedPoints = normalizedVertices.map(v => 
      worldToLocalAndWorld(v, mCombined)
    );

    const screenPoints = transformedPoints.map(v => 
      projectToScreen(worldToView(v, cameraWithProj), width, height, cameraWithProj)
    );

    // 5. Draw User Object Faces Fill (Polygons back-to-front volume)
    activeModel.faces.forEach((face) => {
      ctx.beginPath();
      let lastPtValid = false;
      face.forEach((idx, stepIdx) => {
        const scPt = screenPoints[idx];
        if (scPt) {
          if (stepIdx === 0) {
            ctx.moveTo(scPt[0], scPt[1]);
            lastPtValid = true;
          } else {
            ctx.lineTo(scPt[0], scPt[1]);
          }
        }
      });
      if (lastPtValid) {
        ctx.closePath();
        // Translucent cyan fill to highlight polygons
        ctx.fillStyle = 'rgba(34, 211, 238, 0.06)';
        ctx.fill();
      }
    });

    // 6. Draw User Object Wireframe Edges
    ctx.strokeStyle = challengeSuccess ? '#10b981' : '#22d3ee'; // success emerald or glowing cyan-400
    ctx.lineWidth = 2.2;
    activeModel.edges.forEach(([i, j]) => {
      const pt1 = screenPoints[i];
      const pt2 = screenPoints[j];
      if (pt1 && pt2) {
        ctx.beginPath();
        ctx.moveTo(pt1[0], pt1[1]);
        ctx.lineTo(pt2[0], pt2[1]);
        ctx.stroke();
      }
    });

    // 7. Draw Object Bounding Box
    if (displayOptions.showBoundingBox) {
      // Normalized bounding box model is basically unit box bounds of -1 to 1 based on normalization scale
      // Let's get the exact bounding box corners of the normalized shape!
      let minX = normalizedVertices[0][0], maxX = normalizedVertices[0][0];
      let minY = normalizedVertices[0][1], maxY = normalizedVertices[0][1];
      let minZ = normalizedVertices[0][2], maxZ = normalizedVertices[0][2];

      for (let i = 1; i < normalizedVertices.length; i++) {
        const [x, y, z] = normalizedVertices[i];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }

      const bboxCorners = getBoundingBoxCorners([minX, minY, minZ], [maxX, maxY, maxZ]);
      const transCorners = bboxCorners.map(v => worldToLocalAndWorld(v, mCombined));
      const bboxScreenPoints = transCorners.map(v => 
        projectToScreen(worldToView(v, cameraWithProj), width, height, cameraWithProj)
      );

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // Slate line for box
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);

      BOX_EDGES.forEach(([i, j]) => {
        const pA = bboxScreenPoints[i];
        const pB = bboxScreenPoints[j];
        if (pA && pB) {
          ctx.beginPath();
          ctx.moveTo(pA[0], pA[1]);
          ctx.lineTo(pB[0], pB[1]);
          ctx.stroke();
        }
      });

      ctx.setLineDash([]); // clear dash

      // Draw bounding box label near corner index 2 (max max max)
      const pMax = bboxScreenPoints[2];
      if (pMax) {
        ctx.fillStyle = '#a1a1aa';
        ctx.font = '9px monospace';
        ctx.fillText('Bounding Box (AABB)', pMax[0] + 5, pMax[1] - 5);
      }
    }

    // 8. Draw Object Vertex Labels and Knobs
    screenPoints.forEach((sc, idx) => {
      if (!sc) return;
      ctx.fillStyle = challengeSuccess ? '#10b981' : '#22d3ee';
      ctx.beginPath();
      ctx.arc(sc[0], sc[1], idx === 0 ? 5.5 : 4, 0, Math.PI * 2); // Vertex 0 is highlighted larger (pivot offset guide)
      ctx.fill();

      if (displayOptions.showVertexLabels) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        const vertexModelCoords = activeModel.rawVertices[idx];
        const normCoords = normalizedVertices[idx];
        ctx.fillText(
          `V${idx} (${fmt(normCoords[0])}, ${fmt(normCoords[1])}, ${fmt(normCoords[2])})`, 
          sc[0] + 6, 
          sc[1] - 4
        );
      }
    });

    // 9. Draw Dynamic Object Local Center / Pivot
    if (displayOptions.showCenter) {
      // The object center in local coordinates is [0, 0, 0].
      // Applying mCombined yields its current location in world coordinate space.
      const localCenterWorld = worldToLocalAndWorld([0, 0, 0], mCombined);
      const scCenter = projectToScreen(worldToView(localCenterWorld, cameraWithProj), width, height, cameraWithProj);

      if (scCenter) {
        // Draw a glowing orange core to represent the pivot / rotation hub
        ctx.strokeStyle = '#f59e0b'; // Amber-500
        ctx.fillStyle = '#b45309'; // Amber-700
        ctx.lineWidth = 2.5;

        ctx.beginPath();
        ctx.arc(scCenter[0], scCenter[1], 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#fbbf24'; // Amber-400
        ctx.font = 'bold 10px monospace';
        ctx.fillText('Model Center [0,0,0]_local', scCenter[0] + 10, scCenter[1] + 4);

        // Render Local Axes to illustrate how they spin under Local Rotations
        if (showLocalAxes) {
          const localAxisLen = 0.5;
          const axisXLocal = worldToLocalAndWorld([localAxisLen, 0, 0], mCombined);
          const axisYLocal = worldToLocalAndWorld([0, localAxisLen, 0], mCombined);
          const axisZLocal = worldToLocalAndWorld([0, 0, localAxisLen], mCombined);

          const scAX = projectToScreen(worldToView(axisXLocal, cameraWithProj), width, height, cameraWithProj);
          const scAY = projectToScreen(worldToView(axisYLocal, cameraWithProj), width, height, cameraWithProj);
          const scAZ = projectToScreen(worldToView(axisZLocal, cameraWithProj), width, height, cameraWithProj);

          // Local X (light orange red)
          if (scAX) {
            ctx.strokeStyle = '#f87171'; // Red-400
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(scCenter[0], scCenter[1]);
            ctx.lineTo(scAX[0], scAX[1]);
            ctx.stroke();
            ctx.fillStyle = '#f87171';
            ctx.font = '8px monospace';
            ctx.fillText('x_local', scAX[0] + 2, scAX[1] + 2);
          }

          // Local Y (light green)
          if (scAY) {
            ctx.strokeStyle = '#4ade80'; // Green-400
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(scCenter[0], scCenter[1]);
            ctx.lineTo(scAY[0], scAY[1]);
            ctx.stroke();
            ctx.fillStyle = '#4ade80';
            ctx.font = '8px monospace';
            ctx.fillText('y_local', scAY[0] - 8, scAY[1] - 4);
          }

          // Local Z (light blue)
          if (scAZ) {
            ctx.strokeStyle = '#60a5fa'; // Blue-400
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(scCenter[0], scCenter[1]);
            ctx.lineTo(scAZ[0], scAZ[1]);
            ctx.stroke();
            ctx.fillStyle = '#60a5fa';
            ctx.font = '8px monospace';
            ctx.fillText('z_local', scAZ[0] + 2, scAZ[1] + 2);
          }
        }
      }
    }

    // 10. Render Camera Indicator
    ctx.fillStyle = 'rgba(15, 15, 15, 0.85)';
    ctx.fillRect(8, 8, 145, 24);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.strokeRect(8, 8, 145, 24);
    ctx.fillStyle = '#888888';
    ctx.font = '10px monospace';
    ctx.fillText(`CAM Orbit: ${Math.round(camera.angleY)}°, ${Math.round(camera.angleX)}°`, 14, 23);

  }, [
    canvasSize, settings, displayOptions, showLocalAxes, showGrid, camera,
    activeShape, normalizedVertices, challengeMode, challengeIndex, 
    mCombined, mTargetCombined, targetNormalizedVerts, targetModel, challengeSuccess
  ]);

  // Compute description text dynamically based on actual transformed outputs
  const actionExplanation = useMemo(() => {
    let explanation = '';
    
    const isLocalT = settings.localTranslation.x !== 0 || settings.localTranslation.y !== 0 || settings.localTranslation.z !== 0;
    const isLocalR = settings.localRotation.x !== 0 || settings.localRotation.y !== 0 || settings.localRotation.z !== 0;
    const isLocalS = settings.localScale.x !== 1 || settings.localScale.y !== 1 || settings.localScale.z !== 1;

    const isWorldT = settings.worldTranslation.x !== 0 || settings.worldTranslation.y !== 0 || settings.worldTranslation.z !== 0;
    const isWorldR = settings.worldRotation.x !== 0 || settings.worldRotation.y !== 0 || settings.worldRotation.z !== 0;
    const isWorldS = settings.worldScale.x !== 1 || settings.worldScale.y !== 1 || settings.worldScale.z !== 1;

    if (!isLocalT && !isLocalR && !isLocalS && !isWorldT && !isWorldR && !isWorldS) {
      return "All transformation cells are currently equal to the Identity Matrix. The raw vertices are sitting in their normalized space centered around the absolute World Origin (0,0,0). Observe the X/Y/Z arrows!";
    }

    if (isLocalR && !isWorldR) {
      explanation += `🔄 Your Local Rotation rotates the object vertices around its internal Local Pivot point [0,0,0]_local (${fmt(settings.localTranslation.x)}, ${fmt(settings.localTranslation.y)}, ${fmt(settings.localTranslation.z)} in parent coordinate space). Note how the local coordinate axis orientation rotates with the vertices, keeping the model shape synchronized! `;
    }

    if (isWorldR) {
      explanation += `🌎 Your World Rotation rotates the ENTIRE local coordinate frame (including its pivot and any local translations) around the global absolute origin [0,0,0] in world space. This causes the object to sweep or orbital-orbit away from the center! `;
    }

    if (isLocalS) {
      explanation += `📏 Local Scaling shrinks or expands the shape relative to its own center BEFORE applying any translation. `;
    }

    if (isWorldS && (settings.worldScale.x !== 1 || settings.worldScale.y !== 1 || settings.worldScale.z !== 1)) {
      explanation += `⚖️ World Scaling magnifies or compresses the entire coordinates system along global axes AFTER local scale and rotations are composite. `;
    }

    if (isLocalT) {
      explanation += `📍 Local Translation shifts the shape center in the object's own local workspace coordinate systems. `;
    }

    if (isWorldT) {
      explanation += `🚀 World Translation moves the final composite object directly along global X, Y, or Z directions. `;
    }

    return explanation.trim();
  }, [settings]);

  // Handle simulation of OBJ text template live
  const objSimulatedText = useMemo(() => {
    return generateOBJText(activeModel);
  }, [activeShape, activeModel]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-gray-200 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-white overflow-hidden h-full w-full select-none">
      {/* HEADER BAR */}
      <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#111111] shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-cyan-500 rounded-sm rotate-12 flex items-center justify-center shrink-0">
            <Compass className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-semibold tracking-tight uppercase text-white flex items-center gap-1.5">
              3D Transform Visualizer
              <span className="text-cyan-500 font-mono text-[10px] border border-cyan-500/20 px-1 py-0.2 bg-cyan-950/20 rounded hidden sm:inline">v1.0.4</span>
            </h1>
          </div>
        </div>

        {/* Center: Challenge Mode Toggle Badge */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <button
            id="challenge-toggle-btn"
            onClick={() => {
              setChallengeMode(!challengeMode);
              handleResetTransforms();
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono tracking-wider uppercase transition-all duration-300 border-2 cursor-pointer ${
              challengeMode 
                ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950 font-black shadow-[0_0_20px_rgba(245,158,11,0.6)] scale-105' 
                : 'bg-cyan-950/30 hover:bg-cyan-950/60 text-cyan-400 hover:text-cyan-300 border-cyan-500/50 hover:border-cyan-400 font-extrabold shadow-[0_0_8px_rgba(34,211,238,0.15)] hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]'
            }`}
          >
            {challengeMode ? "CHALLENGE ACTIVE" : "CHALLENGE MODE"}
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono z-10">
          <button
            id="reset-all-transforms-btn"
            onClick={handleResetTransforms}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-3 py-1 rounded text-xs font-bold transition duration-200 cursor-pointer"
            title="Reset transformations back to identity values"
          >
            <RotateCcw className="w-3 h-3 text-cyan-500" />
            <span className="hidden sm:inline">RESET ALL</span>
            <span className="sm:hidden">RESET</span>
          </button>
        </div>
      </header>

      {/* CORE THREE-PANEL WRAPPER */}
      <div className="flex flex-1 flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden bg-[#0A0A0A]">
        
        {/* LEFT PANEL: transformation control sliders */}
        <aside className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#0F0F0F] flex flex-col shrink-0 overflow-y-auto select-none">
          
          {/* Dynamic CG Concept Insight Banner */}
          <div className="p-4 border-b border-white/10 bg-[#111111]/40">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-cyan-500/10 rounded text-cyan-400 shrink-0">
                <Info className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block font-sans">
                  Algebraic Flow Insight
                </span>
                <p className="text-[11px] text-gray-400 leading-relaxed font-sans">
                  The vertices <code className="text-cyan-400 px-1 py-0.2 bg-black rounded font-mono">V</code> undergo matrix multiplication:
                  <span className="block mt-1 font-mono text-cyan-400 text-[10px] bg-black p-1.5 rounded border border-white/5 overflow-x-auto whitespace-nowrap">
                    V_world = (M_worldT * M_worldR * M_worldS) * (M_localT * M_localR * M_localS) * V_normalized
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* LOCAL TRANSFORMS BLOCK */}
          <section className="p-4 border-b border-white/10">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Local Transformations</h2>
            
            <div className="space-y-4">
              {/* Local Translation */}
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                  <span className="text-gray-400">TRANSLATION</span>
                  <span className="text-cyan-400">
                    [{fmt(settings.localTranslation.x)}, {fmt(settings.localTranslation.y)}, {fmt(settings.localTranslation.z)}]
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['x', 'y', 'z'].map((axis) => {
                    const ax = axis as 'x' | 'y' | 'z';
                    return (
                      <div key={`lt-${axis}`} className="bg-black/40 p-1.5 rounded border border-white/5">
                        <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
                          <span className="font-bold uppercase text-cyan-500">{axis}</span>
                          <button 
                            onClick={() => updateTransform('localTranslation', ax, 0)}
                            className="hover:text-white hover:bg-white/10 px-1 rounded text-[8px] cursor-pointer"
                          >
                            0
                          </button>
                        </div>
                        <input
                          type="range"
                          min="-2.0"
                          max="2.0"
                          step="0.1"
                          value={settings.localTranslation[ax]}
                          onChange={(e) => updateTransform('localTranslation', ax, parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 opacity-80 h-1 cursor-ew-resize py-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Local Rotation */}
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                  <span className="text-gray-400">ROTATION</span>
                  <span className="text-cyan-400">
                    [{settings.localRotation.x}°, {settings.localRotation.y}°, {settings.localRotation.z}°]
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['x', 'y', 'z'].map((axis) => {
                    const ax = axis as 'x' | 'y' | 'z';
                    return (
                      <div key={`lr-${axis}`} className="bg-black/40 p-1.5 rounded border border-white/5">
                        <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
                          <span className="font-bold uppercase text-cyan-500">{axis}</span>
                          <button 
                            onClick={() => updateTransform('localRotation', ax, 0)}
                            className="hover:text-white hover:bg-white/10 px-1 rounded text-[8px] cursor-pointer"
                          >
                            0°
                          </button>
                        </div>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="5"
                          value={settings.localRotation[ax]}
                          onChange={(e) => updateTransform('localRotation', ax, parseInt(e.target.value))}
                          className="w-full accent-cyan-500 opacity-80 h-1 cursor-ew-resize py-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Local Scale */}
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                  <span className="text-gray-400">SCALE</span>
                  <span className="text-cyan-400">
                    [{fmt(settings.localScale.x)}, {fmt(settings.localScale.y)}, {fmt(settings.localScale.z)}]
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['x', 'y', 'z'].map((axis) => {
                    const ax = axis as 'x' | 'y' | 'z';
                    return (
                      <div key={`ls-${axis}`} className="bg-black/40 p-1.5 rounded border border-white/5">
                        <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
                          <span className="font-bold uppercase text-cyan-500">{axis}</span>
                          <button 
                            onClick={() => updateTransform('localScale', ax, 1.0)}
                            className="hover:text-white hover:bg-white/10 px-1 rounded text-[8px] cursor-pointer"
                          >
                            1.0
                          </button>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.5"
                          step="0.1"
                          value={settings.localScale[ax]}
                          onChange={(e) => updateTransform('localScale', ax, parseFloat(e.target.value))}
                          className="w-full accent-cyan-500 opacity-80 h-1 cursor-ew-resize py-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* WORLD TRANSFORMS BLOCK */}
          <section className="p-4 border-b border-white/10">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">World Transformations</h2>
            
            <div className="space-y-4">
              {/* World Translation */}
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                  <span className="text-gray-400">TRANSLATION</span>
                  <span className="text-amber-400">
                    [{fmt(settings.worldTranslation.x)}, {fmt(settings.worldTranslation.y)}, {fmt(settings.worldTranslation.z)}]
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['x', 'y', 'z'].map((axis) => {
                    const ax = axis as 'x' | 'y' | 'z';
                    return (
                      <div key={`wt-${axis}`} className="bg-black/40 p-1.5 rounded border border-white/5">
                        <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
                          <span className="font-bold uppercase text-amber-500">{axis}</span>
                          <button 
                            onClick={() => updateTransform('worldTranslation', ax, 0)}
                            className="hover:text-white hover:bg-white/10 px-1 rounded text-[8px] cursor-pointer"
                          >
                            0
                          </button>
                        </div>
                        <input
                          type="range"
                          min="-2.0"
                          max="2.0"
                          step="0.1"
                          value={settings.worldTranslation[ax]}
                          onChange={(e) => updateTransform('worldTranslation', ax, parseFloat(e.target.value))}
                          className="w-full accent-amber-500 opacity-80 h-1 cursor-ew-resize py-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* World Rotation */}
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                  <span className="text-gray-400">ROTATION</span>
                  <span className="text-amber-400">
                    [{settings.worldRotation.x}°, {settings.worldRotation.y}°, {settings.worldRotation.z}°]
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['x', 'y', 'z'].map((axis) => {
                    const ax = axis as 'x' | 'y' | 'z';
                    return (
                      <div key={`wr-${axis}`} className="bg-black/40 p-1.5 rounded border border-white/5">
                        <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
                          <span className="font-bold uppercase text-amber-500">{axis}</span>
                          <button 
                            onClick={() => updateTransform('worldRotation', ax, 0)}
                            className="hover:text-white hover:bg-white/10 px-1 rounded text-[8px] cursor-pointer"
                          >
                            0°
                          </button>
                        </div>
                        <input
                          type="range"
                          min="-180"
                          max="180"
                          step="5"
                          value={settings.worldRotation[ax]}
                          onChange={(e) => updateTransform('worldRotation', ax, parseInt(e.target.value))}
                          className="w-full accent-amber-500 opacity-80 h-1 cursor-ew-resize py-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* World Scale */}
              <div>
                <div className="flex justify-between text-[10px] mb-1.5 font-mono">
                  <span className="text-gray-400">SCALE</span>
                  <span className="text-amber-400">
                    [{fmt(settings.worldScale.x)}, {fmt(settings.worldScale.y)}, {fmt(settings.worldScale.z)}]
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['x', 'y', 'z'].map((axis) => {
                    const ax = axis as 'x' | 'y' | 'z';
                    return (
                      <div key={`ws-${axis}`} className="bg-black/40 p-1.5 rounded border border-white/5">
                        <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1">
                          <span className="font-bold uppercase text-amber-500">{axis}</span>
                          <button 
                            onClick={() => updateTransform('worldScale', ax, 1.0)}
                            className="hover:text-white hover:bg-white/10 px-1 rounded text-[8px] cursor-pointer"
                          >
                            1.0
                          </button>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="2.5"
                          step="0.1"
                          value={settings.worldScale[ax]}
                          onChange={(e) => updateTransform('worldScale', ax, parseFloat(e.target.value))}
                          className="w-full accent-amber-500 opacity-80 h-1 cursor-ew-resize py-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* BOTTOM QUICK TIP FOOTER NOTE */}
          <div className="p-4 bg-black/40 border-t border-white/5 mt-auto hidden lg:block select-none">
             <div className="text-[10px] text-gray-600 mb-1 font-mono uppercase tracking-widest font-bold">CG SYSTEM NOTE:</div>
             <p className="text-[11px] leading-relaxed text-gray-500 italic font-sans">
               Local transformations apply to the coordinates of vertex arrays relative to the model's pivot frame, prior to world scene coordinate space orientation.
             </p>
          </div>
        </aside>

        {/* CENTER COLUMN: 3D wireframe render viewport screen */}
        <main className="flex-1 min-h-0 bg-black flex flex-col p-4 space-y-4 overflow-y-auto select-none border-b lg:border-b-0 border-white/10">
          
          {/* CAMERA ORBIT CONTROL HEADER & MODEL SELECTOR */}
          <div className="bg-[#111111] border border-white/10 p-3 rounded-xl flex items-center justify-between gap-3 shadow-sm select-none">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-gray-400 select-none font-mono uppercase tracking-wider">Shape:</span>
              <div className="inline-flex rounded-lg bg-black p-0.5 border border-white/10">
                {(['cube', 'pyramid', 'prism'] as ShapeType[]).map((shape) => (
                  <button
                    key={shape}
                    id={`shape-select-${shape}`}
                    disabled={challengeMode}
                    onClick={() => setActiveShape(shape)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition uppercase font-mono tracking-wide cursor-pointer ${
                      activeShape === shape
                        ? 'bg-cyan-600 text-white shadow shadow-cyan-500/20'
                        : 'text-gray-400 hover:text-white disabled:hover:text-gray-500 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                id="camera-zoom-out"
                onClick={() => setCamera(prev => ({ ...prev, distance: Math.min(8.0, prev.distance + 0.5) }))}
                className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition"
                title="Zoom Out Camera"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                id="camera-zoom-in"
                onClick={() => setCamera(prev => ({ ...prev, distance: Math.max(1.5, prev.distance - 0.5) }))}
                className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition"
                title="Zoom In Camera"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                id="camera-reset-view"
                onClick={handleResetCamera}
                className="p-1.5 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition flex items-center gap-1 text-xs font-mono cursor-pointer"
                title="Reset viewpoint rotation"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-500" />
                Reset Cam
              </button>
            </div>
          </div>

          {/* CANVAS STAGE CARD */}
          <div 
            ref={containerRef}
            className="flex-1 bg-[#060606] border border-white/10 rounded-2xl relative shadow-2xl flex flex-col min-h-[440px] overflow-hidden group select-none"
          >
            {/* SVG Radial Grid layout */}
            <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

            {/* 3D Canvas element holding rendering grid context */}
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              className="cursor-grab active:cursor-grabbing block w-full flex-1"
            />

            {/* Hint drag overlays */}
            <div className="absolute bottom-3 left-3 bg-[#111111]/90 text-[10px] text-gray-400 font-mono px-2 py-1 border border-white/10 rounded pointer-events-none tracking-wide select-none">
              🖱️ Drag inside canvas to rotate view camera orbit
            </div>

            {/* Normalization status indicator inside screen */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-mono font-bold tracking-wider px-2 py-1 rounded border border-emerald-500/20">
                GPU Centered: Normalized
              </span>
            </div>

            {/* Challenge Success Banner */}
            {challengeMode && challengeSuccess && (
              <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center p-6 text-center animate-fade-in z-20 border border-emerald-500/20">
                <div className="p-4 bg-emerald-500/10 rounded-full text-emerald-400 border border-emerald-500/30 animate-pulse mb-3">
                  <Sparkles className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-emerald-400 font-sans tracking-wide uppercase">
                  Level Complete!
                </h3>
                <p className="text-xs text-gray-400 max-w-sm mt-1 leading-relaxed font-sans">
                  Excellent work! Your matrix pipeline yields a vertex-to-vertex match score of <span className="text-emerald-400 font-bold">100%</span>.
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => {
                      if (challengeIndex < CHALLENGES.length - 1) {
                        setChallengeIndex(challengeIndex + 1);
                      } else {
                        setChallengeIndex(0); // wrap
                      }
                      setSettings(defaultSettings);
                      setChallengeSuccess(false);
                      setShowHint(false);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    Next Challenge
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setChallengeMode(false);
                      handleResetTransforms();
                    }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer border border-white/10"
                  >
                    Sandbox Practice
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* QUICK TOGGLE BUTTONS SHELF */}
          <div className="bg-[#111111] border border-white/10 p-3 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              id="toggle-bbox-btn"
              onClick={() => setDisplayOptions(prev => ({ ...prev, showBoundingBox: !prev.showBoundingBox }))}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-mono transition border cursor-pointer ${
                displayOptions.showBoundingBox 
                  ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30 font-bold' 
                  : 'bg-white/5 text-gray-400 border-transparent hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="flex items-center gap-1">
                {displayOptions.showBoundingBox ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                Bound Box
              </span>
              <span className="text-[9px] opacity-75">AABB</span>
            </button>

            <button
              id="toggle-axes-btn"
              onClick={() => setDisplayOptions(prev => ({ ...prev, showAxes: !prev.showAxes }))}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono transition border cursor-pointer ${
                displayOptions.showAxes 
                  ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30 font-bold' 
                  : 'bg-white/5 text-gray-400 border-transparent hover:text-white hover:bg-white/10'
              }`}
            >
              {displayOptions.showAxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              World Axes
            </button>

            <button
              id="toggle-center-btn"
              onClick={() => setDisplayOptions(prev => ({ ...prev, showCenter: !prev.showCenter }))}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono transition border cursor-pointer ${
                displayOptions.showCenter 
                  ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30 font-bold' 
                  : 'bg-white/5 text-gray-400 border-transparent hover:text-white hover:bg-white/10'
              }`}
            >
              {displayOptions.showCenter ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Pivot Center
            </button>

            <button
              id="toggle-local-axes-btn"
              onClick={() => setShowLocalAxes(!showLocalAxes)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-mono transition border cursor-pointer ${
                showLocalAxes 
                  ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30 font-bold' 
                  : 'bg-white/5 text-gray-400 border-transparent hover:text-white hover:bg-white/10'
              }`}
            >
              {showLocalAxes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              Local Gizmos
            </button>
          </div>

          <div className="bg-[#111111] border border-white/10 p-3 rounded-xl grid grid-cols-2 gap-2">
            <button
              id="toggle-labels-btn"
              onClick={() => setDisplayOptions(prev => ({ ...prev, showVertexLabels: !prev.showVertexLabels }))}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-mono transition border cursor-pointer ${
                displayOptions.showVertexLabels
                  ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30 font-bold'
                  : 'bg-white/5 text-gray-400 border-transparent hover:text-white hover:bg-white/10'
              }`}
            >
              {displayOptions.showVertexLabels ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
              Vertex Coordinates Output
            </button>

            <button
              id="toggle-projection-btn"
              onClick={() => setDisplayOptions(prev => ({ ...prev, projection: prev.projection === 'perspective' ? 'orthographic' : 'perspective' }))}
              className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded text-xs text-gray-300 font-mono tracking-wide cursor-pointer transition hover:text-white"
            >
              <Layout className="w-3.5 h-3.5 text-cyan-400" />
              Mode: <span className="capitalize text-white font-mono font-bold">{displayOptions.projection}</span>
            </button>
          </div>

          {/* DYNAMIC COMPREHENSIVE TEXT EXPLANATION CARD */}
          <section className="bg-black/40 border border-white/10 rounded-xl p-4 shadow-sm select-none">
            <h3 className="text-xs uppercase font-bold text-cyan-400 tracking-wider mb-2 flex items-center gap-1.5 font-mono">
              <Code className="w-3.5 h-3.5 text-cyan-500" />
              Transformation Explanation
            </h3>
            <p id="action-explanation-box" className="text-xs text-gray-400 leading-relaxed font-sans">
              {actionExplanation}
            </p>
          </section>

        </main>

        {/* RIGHT COLUMN: Normalizer details, simulated OBJ preview and matrix values */}
        <aside className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#0F0F0F] flex flex-col shrink-0 overflow-y-auto select-none p-4 space-y-4">

          {/* GAME CHALLENGE PANEL */}
          {challengeMode && currentChallenge && (
            <section className="bg-gradient-to-b from-indigo-950/45 to-slate-950 border border-indigo-500/30 rounded-xl p-4 shadow-xl ring-1 ring-white/5 relative">
              <span className="absolute -top-2.5 left-4 px-2 py-0.5 bg-indigo-500 text-white text-[9px] font-bold rounded-full tracking-widest uppercase">
                CG CHALLENGE PLATFORM
              </span>

              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-300 font-serif">
                  {currentChallenge.title}
                </span>
                <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] px-1.5 py-0.5 font-mono rounded font-bold">
                  Shape: {currentChallenge.targetShape}
                </span>
              </div>

              <p className="text-xs text-slate-200 font-sans leading-relaxed">
                {currentChallenge.description}
              </p>

              <div className="mt-2 text-[11px] text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-900 leading-relaxed">
                <span className="font-bold text-indigo-300 block mb-0.5">Instructions:</span>
                {currentChallenge.instructions}
              </div>

              {/* Progress score bar matches */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 font-medium">Silhouette Match Accuracy</span>
                  <span className="text-emerald-400 font-mono font-bold text-sm bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">
                    {challengeScore}%
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className={`h-full transition-all duration-300 ${
                      challengeScore > 80 
                        ? 'bg-emerald-500' 
                        : challengeScore > 50 
                          ? 'bg-amber-500' 
                          : 'bg-indigo-600'
                    }`}
                    style={{ width: `${challengeScore}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  id="challenge-hint-btn"
                  onClick={() => setShowHint(!showHint)}
                  className="w-full bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition border border-slate-800 flex items-center justify-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                  {showHint ? "Hide Educational Hint" : "Reveal Target Hint"}
                </button>

                {showHint && (
                  <div className="p-2.5 bg-slate-950 rounded border border-amber-500/20 text-[11px] text-slate-300 font-mono leading-relaxed mt-1">
                    <span className="text-amber-400 font-bold block mb-0.5">Hint / Cheat Coordinates:</span>
                    {currentChallenge.hint}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    id="challenge-auto-solve"
                    onClick={handleSolveChallenge}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-1.5 px-2 rounded-lg transition text-center flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Auto Align
                  </button>
                  <button
                    id="challenge-reset-state"
                    onClick={handleResetTransforms}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold py-1.5 px-2 rounded-lg transition text-center cursor-pointer border border-slate-700"
                  >
                    Clear Sliders
                  </button>
                </div>
              </div>
            </section>
          )}
             {/* OBJ NORMALIZATION DEMO STATISTICS */}
          <section className="p-4 border-b border-white/10">
            <h3 className="text-xs uppercase font-extrabold text-cyan-400 tracking-wider flex items-center gap-1.5 font-mono mb-3">
              <FileText className="w-3.5 h-3.5" />
              Normalization Statistics
            </h3>

            <div className="bg-black/60 p-3 rounded border border-white/5 text-xs font-mono space-y-2 select-none">
              <div className="flex justify-between border-b border-white/5 pb-1 text-[11px]">
                <span className="text-gray-500 font-mono">SOURCE ASSET</span>
                <span className="text-cyan-400 font-bold uppercase">{activeModel.name}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">MIN BOX BOUNDS</span>
                <span className="text-gray-300">
                  [{normParams.minBounds[0].toFixed(1)}, {normParams.minBounds[1].toFixed(1)}, {normParams.minBounds[2].toFixed(1)}]
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">MAX BOX BOUNDS</span>
                <span className="text-gray-300">
                  [{normParams.maxBounds[0].toFixed(1)}, {normParams.maxBounds[1].toFixed(1)}, {normParams.maxBounds[2].toFixed(1)}]
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">RAW CENTER</span>
                <span className="text-cyan-400 font-bold">
                  [{normParams.center[0].toFixed(1)}, {normParams.center[1].toFixed(1)}, {normParams.center[2].toFixed(1)}]
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">EXTENTS</span>
                <span className="text-gray-300">
                  ({normParams.extent[0].toFixed(1)} × {normParams.extent[1].toFixed(1)} × {normParams.extent[2].toFixed(1)})
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">MAX EXTENT</span>
                <span className="text-gray-300">{normParams.maxExtent.toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-gray-500">NORM SCALE factor</span>
                <span className="text-amber-400 font-bold">{normParams.scaleFactor.toFixed(4)}</span>
              </div>
            </div>

            <div className="text-[11px] text-gray-400 leading-relaxed font-sans mt-2">
              💡 <span className="text-gray-300 font-semibold">Mesh Centering:</span> Calculating model extents, we center coordinate vectors to origin via <code className="text-cyan-400 font-mono">Vi - Center</code>, scaling space uniformly to ensure standard wireframe rendering on any device.
            </div>

            {/* OBJ File Preview Button */}
            <div className="mt-3">
              <button
                id="toggle-obj-preview-btn"
                onClick={() => setShowObjPreview(!showObjPreview)}
                className="w-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs py-1.5 px-3 rounded cursor-pointer transition flex items-center justify-center gap-1 font-mono font-bold"
              >
                <Code className="w-3.5 h-3.5 text-cyan-400" />
                {showObjPreview ? "HIDE OBJ CODE" : "SHOW OBJ SOURCE"}
              </button>

              {showObjPreview && (
                <div className="mt-3 animate-fade-in font-mono">
                  <div className="flex items-center justify-between text-[9px] bg-[#111111] p-2 text-gray-400 border border-white/10 border-b-0 rounded-t">
                    <span>asset_mesh.obj</span>
                    <span className="text-cyan-400 font-bold">WAVEFRONT</span>
                  </div>
                  <textarea
                    readOnly
                    value={objSimulatedText}
                    rows={6}
                    className="w-full p-2 bg-[#060606] border border-white/10 text-[9px] font-mono text-gray-400 rounded-b overflow-auto leading-relaxed resize-none focus:outline-none"
                  />
                </div>
              )}
            </div>
          </section>

          {/* COMPOUND MATRIX MATH LAB PANEL */}
          {displayOptions.showMatrixMath && (
            <section className="p-4 border-b border-white/10">
              <h3 className="text-xs uppercase font-extrabold text-cyan-400 tracking-wider flex items-center gap-1.5 font-mono mb-3">
                <Layout className="w-3.5 h-3.5 text-cyan-500" />
                Matrix Math Engine
              </h3>

              <div className="space-y-3">
                {/* Local Matrix */}
                <div>
                  <span className="text-[10px] text-cyan-400 font-bold block mb-1 font-mono uppercase tracking-wide">
                    [M_local] TRS Matrix (Local Space)
                  </span>
                  <div className="grid grid-cols-4 gap-1 p-2 bg-black/60 rounded border border-white/5 text-[10px] font-mono text-gray-400 text-center">
                    {mLocal.map((row, rIdx) => 
                      row.map((val, cIdx) => (
                        <span 
                          key={`ml-${rIdx}-${cIdx}`} 
                          className={cIdx === 3 ? 'text-amber-500 font-bold' : (rIdx === cIdx ? 'text-cyan-400 font-bold' : '')}
                        >
                          {fmt(val)}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* World Matrix */}
                <div>
                  <span className="text-[10px] text-amber-500 font-bold block mb-1 font-mono uppercase tracking-wide">
                    [M_world] TRS Matrix (World Space)
                  </span>
                  <div className="grid grid-cols-4 gap-1 p-2 bg-black/60 rounded border border-white/5 text-[10px] font-mono text-gray-400 text-center">
                    {mWorld.map((row, rIdx) => 
                      row.map((val, cIdx) => (
                        <span 
                          key={`mw-${rIdx}-${cIdx}`} 
                          className={cIdx === 3 ? 'text-cyan-400 font-bold' : (rIdx === cIdx ? 'text-amber-500 font-bold' : '')}
                        >
                          {fmt(val)}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Combined User Matrix */}
                <div>
                  <span className="text-[10px] text-white font-bold block mb-1 font-mono uppercase tracking-wide">
                    [M_combined = M_world * M_local] final
                  </span>
                  <div className="grid grid-cols-4 gap-1 p-2 bg-[#111111] rounded border border-white/10 text-[10px] font-mono text-gray-300 text-center">
                    {mCombined.map((row, rIdx) => 
                      row.map((val, cIdx) => (
                        <span 
                          key={`mc-${rIdx}-${cIdx}`} 
                          className={rIdx === cIdx ? 'text-cyan-400 font-bold' : (cIdx === 3 ? 'text-amber-400 font-bold' : '')}
                        >
                          {fmt(val)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-gray-500 font-sans leading-relaxed mt-3.5 p-2 bg-black/40 rounded border border-white/5">
                📝 Notice how Translation alters the <span className="text-amber-500 font-semibold">rightmost column</span> path, Scale alters the <span className="text-cyan-400 font-semibold">diagonal scaling pivot coefficients</span>, and Rotation changes the global <span className="text-gray-300 font-semibold">upper-left 3x3 diagonal keys</span>.
              </div>
            </section>
          )}

        </aside>

      </div>

    </div>
  );
}
