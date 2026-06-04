/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Matrix4x4, Vector3D, Transform } from '../types';
import { multiply, multiplyVector, rotationX, rotationY } from './matrix';

export interface Camera {
  angleX: number; // orbital angle on Y axis (left-right drag)
  angleY: number; // orbital angle on X axis (up-down drag)
  distance: number;
  fov: number;
  projection: 'perspective' | 'orthographic';
}

/**
 * Transforms a 3D vertex to view space by applying camera rotation.
 * In orbital camera: we rotate the point in reverse order of camera angles,
 * then project.
 */
export function worldToView(vertex: Vector3D, camera: Camera): Vector3D {
  // Let's rotate the world point around the origin (look-at center)
  // based on the camera angles
  const mRotX = rotationX(camera.angleY);
  const mRotY = rotationY(camera.angleX);
  const cameraMatrix = multiply(mRotX, mRotY);

  return multiplyVector(cameraMatrix, vertex);
}

/**
 * Projects a view-space point onto a 2D canvas structure.
 * Returns [x, y, depth] or null if clipped behind camera.
 */
export function projectToScreen(
  vView: Vector3D, 
  width: number, 
  height: number, 
  camera: Camera
): [number, number, number] | null {
  const [vx, vy, vz] = vView;
  const halfW = width / 2;
  const halfH = height / 2;
  const minDim = Math.min(width, height);

  if (camera.projection === 'perspective') {
    // Treat camera at Z = camera.distance looking down negative Z towards origin
    const zOffset = camera.distance - vz;
    
    // Clip objects that are too close or behind the camera lens
    if (zOffset < 0.2) {
      return null;
    }

    const scaleFactor = (camera.fov * minDim) / (zOffset * 4);
    const sx = halfW + vx * scaleFactor;
    const sy = halfH - vy * scaleFactor; // invert Y for screen space

    return [sx, sy, vz];
  } else {
    // Orthographic projection
    const scaleFactor = (minDim / 3.0) * (camera.fov / 150);
    const sx = halfW + vx * scaleFactor;
    const sy = halfH - vy * scaleFactor;

    return [sx, sy, vz]; // depth remains depth
  }
}

/**
 * Computes bounding box vertices from minimum and maximum bounds.
 * Returns 8 corners of the axis-aligned bounding box.
 */
export function getBoundingBoxCorners(minB: Vector3D, maxB: Vector3D): Vector3D[] {
  const [minX, minY, minZ] = minB;
  const [maxX, maxY, maxZ] = maxB;

  return [
    [minX, minY, minZ], // 0
    [maxX, minY, minZ], // 1
    [maxX, maxY, minZ], // 2
    [minX, maxY, minZ], // 3
    [minX, minY, maxZ], // 4
    [maxX, minY, maxZ], // 5
    [maxX, maxY, maxZ], // 6
    [minX, maxY, maxZ], // 7
  ];
}

/**
 * Line sequences connecting the 8 AABB bounding box corners
 */
export const BOX_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // Base front
  [4, 5], [5, 6], [6, 7], [7, 4], // Base back
  [0, 4], [1, 5], [2, 6], [3, 7], // Pillars
];
