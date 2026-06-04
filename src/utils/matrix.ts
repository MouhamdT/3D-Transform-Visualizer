/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Matrix4x4, Vector3D, Transform } from '../types';

/**
 * Creates a 4x4 Identity Matrix.
 */
export function identity(): Matrix4x4 {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

/**
 * Creates a 4x4 Translation Matrix.
 */
export function translation(x: number, y: number, z: number): Matrix4x4 {
  return [
    [1, 0, 0, x],
    [0, 1, 0, y],
    [0, 0, 1, z],
    [0, 0, 0, 1],
  ];
}

/**
 * Creates a 4x4 Scaling Matrix.
 */
export function scale(x: number, y: number, z: number): Matrix4x4 {
  return [
    [x, 0, 0, 0],
    [0, y, 0, 0],
    [0, 0, z, 0],
    [0, 0, 0, 1],
  ];
}

/**
 * Creates a 4x4 Rotation Matrix around the X-axis (pitch).
 * @param deg Angle in degrees
 */
export function rotationX(deg: number): Matrix4x4 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [1, 0,  0, 0],
    [0, c, -s, 0],
    [0, s,  c, 0],
    [0, 0,  0, 1],
  ];
}

/**
 * Creates a 4x4 Rotation Matrix around the Y-axis (yaw).
 * @param deg Angle in degrees
 */
export function rotationY(deg: number): Matrix4x4 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [ c, 0, s, 0],
    [ 0, 1, 0, 0],
    [-s, 0, c, 0],
    [ 0, 0, 0, 1],
  ];
}

/**
 * Creates a 4x4 Rotation Matrix around the Z-axis (roll).
 * @param deg Angle in degrees
 */
export function rotationZ(deg: number): Matrix4x4 {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    [c, -s, 0, 0],
    [s,  c, 0, 0],
    [0,  0, 1, 0],
    [0,  0, 0, 1],
  ];
}

/**
 * Multiplies two 4x4 matrices (A * B).
 */
export function multiply(A: Matrix4x4, B: Matrix4x4): Matrix4x4 {
  const result = identity();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = 0; i < 4; i++) {
        sum += A[r][i] * B[i][c];
      }
      result[r][c] = sum;
    }
  }
  return result;
}

/**
 * Multiplies a 4x4 matrix with a 3D Vector by treating it as homogeneous coord [x, y, z, 1]^T.
 * Performs perspective division by w if w is not 1.
 */
export function multiplyVector(M: Matrix4x4, V: Vector3D): Vector3D {
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

/**
 * Computes a compound transformation matrix representing:
 * translation * rotationZ * rotationY * rotationX * scale
 * Order: S is applied first, then rotations, then T.
 */
export function getTRS(t: Transform, r: Transform, s: Transform): Matrix4x4 {
  const mS = scale(s.x, s.y, s.z);
  const mRx = rotationX(r.x);
  const mRy = rotationY(r.y);
  const mRz = rotationZ(r.z);
  const mT = translation(t.x, t.y, t.z);

  // M = T * Ry * Rx * Rz * S
  // Let's multiply them
  let mR = multiply(mRy, mRx);
  mR = multiply(mR, mRz);
  
  const mRS = multiply(mR, mS);
  return multiply(mT, mRS);
}

/**
 * Format a number to a fixed decimal length for clean math displaying
 */
export function fmt(val: number): string {
  if (Math.abs(val) < 0.0001) return '0.00';
  const s = val.toFixed(2);
  return s === '-0.00' ? '0.00' : s;
}
