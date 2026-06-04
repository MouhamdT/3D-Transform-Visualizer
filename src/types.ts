/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Vector3D = [number, number, number];

export interface Vertex {
  position: Vector3D;
  normal?: Vector3D;
  color?: string;
}

export type Matrix4x4 = [
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number],
  [number, number, number, number]
];

export type ShapeType = 'cube' | 'pyramid' | 'prism';

export interface Transform {
  x: number;
  y: number;
  z: number;
}

export interface TransformSettings {
  localTranslation: Transform;
  localRotation: Transform; // in degrees
  localScale: Transform;
  worldTranslation: Transform;
  worldRotation: Transform; // in degrees
  worldScale: Transform;
}

export interface DisplayOptions {
  showBoundingBox: boolean;
  showAxes: boolean;
  showCenter: boolean;
  showMatrixMath: boolean;
  projection: 'perspective' | 'orthographic';
  showVertexLabels: boolean;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  instructions: string;
  hint: string;
  // Match check parameters
  verify: (settings: TransformSettings) => { success: boolean; progress: number; feedback: string };
}
