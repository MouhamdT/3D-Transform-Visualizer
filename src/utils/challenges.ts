/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ShapeType, TransformSettings } from '../types';

export const INITIAL_TRANSFORMS: TransformSettings = {
  localTranslation: { x: 0, y: 0, z: 0 },
  localRotation: { x: 0, y: 0, z: 0 },
  localScale: { x: 1, y: 1, z: 1 },
  worldTranslation: { x: 0, y: 0, z: 0 },
  worldRotation: { x: 0, y: 0, z: 0 },
  worldScale: { x: 1, y: 1, z: 1 },
};

export interface Challenge {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  instructions: string;
  hint: string;
  targetShape: ShapeType;
  targetSettings: TransformSettings;
  explanation: string;
}

export const CHALLENGES: Challenge[] = [
  {
    id: 'local_spin',
    title: 'Level 1: Local Spin & Scale',
    difficulty: 'Beginner',
    targetShape: 'pyramid',
    description: 'Rotate the pyramid around its own local pivot, squash its height, and stretch its width.',
    instructions: 'Manipulate only Local Transformations to size and twist the pyramid. Change Local Scale Y to squash it (0.7), Local Scale X & Z to stretch it (1.4), and Local Rotation Y to rotate it (45 degrees).',
    hint: 'Apply a Local Rotation Y of 45°, squash Local Scale Y to 0.7, and set Local Scale X & Z to 1.4.',
    explanation: 'Notice how local rotation spins the object around its central pivot. Even when we scale the shape first, rotation behaves centered because scaling and rotating occurs locally before translation.',
    targetSettings: {
      ...INITIAL_TRANSFORMS,
      localRotation: { x: 0, y: 45, z: 0 },
      localScale: { x: 1.4, y: 0.7, z: 1.4 },
    },
  },
  {
    id: 'planetary_orbit',
    title: 'Level 2: Planetary Orbit',
    difficulty: 'Intermediate',
    targetShape: 'cube',
    description: 'Position the cube away from the center, then rotate it around the global origin to simulate an orbital sweep.',
    instructions: 'Translate the object locally along X by 1.5. Then apply World Rotation Y of 60 degrees to sweep it along an orbital curve around the global center!',
    hint: 'Set Local Translation X to 1.5. Then set World Rotation Y to 60° to swing it in a circular path.',
    explanation: 'A world-space rotation orbits the object around the central axis of the entire world (0,0,0) because world rotation is applied AFTER translation. If we had rotated locally instead, the object would have just spun in-place at its offset position!',
    targetSettings: {
      ...INITIAL_TRANSFORMS,
      localTranslation: { x: 1.5, y: 0, z: 0 },
      worldTranslation: { x: 0, y: 0.5, z: 0 },
      worldRotation: { x: 0, y: 60, z: 0 },
    },
  },
  {
    id: 'skew_prism',
    title: 'Level 3: Cosmic Alignment',
    difficulty: 'Advanced',
    targetShape: 'prism',
    description: 'Use a combinations of both local rotation, world translation, and scaling to align the triangular prism.',
    instructions: 'Combine local and world properties: Local Rotation Z is -30°, Local Scale is 1.2 for X, Y, Z. World Translation is X: 1.0, Y: -0.5, Z: 0.5. World Rotation Y is -45°.',
    hint: 'Local Rotation Z = -30, Local Scale [X, Y, Z] = 1.2. World Translation X = 1.0, Y = -0.5, Z = 0.5. World Rotation Y = -45.',
    explanation: 'Observe how the local scale modifications swell the local geometry, after which local roll tilts orientation, and world elements pitch and coordinate the final global framing.',
    targetSettings: {
      ...INITIAL_TRANSFORMS,
      localRotation: { x: 0, y: 0, z: -30 },
      localScale: { x: 1.2, y: 1.2, z: 1.2 },
      worldTranslation: { x: 1.0, y: -0.5, z: 0.5 },
      worldRotation: { x: 0, y: -45, z: 0 },
    },
  },
];

/**
 * Calculates a match percentage based on the similarity of two sets of transformed vertices
 */
export function calculateMatchScore(userVerts: [number, number, number][], targetVerts: [number, number, number][]): number {
  if (userVerts.length === 0 || targetVerts.length === 0 || userVerts.length !== targetVerts.length) {
    return 0;
  }

  let totalSqDistance = 0;
  for (let i = 0; i < userVerts.length; i++) {
    const [ux, uy, uz] = userVerts[i];
    const [tx, ty, tz] = targetVerts[i];
    const dx = ux - tx;
    const dy = uy - ty;
    const dz = uz - tz;
    totalSqDistance += (dx * dx + dy * dy + dz * dz);
  }

  const avgDistance = Math.sqrt(totalSqDistance / userVerts.length);

  // A small tolerance threshold. If the average distance is 0, score is 100%.
  // If the average distance is 1.3 units, score is 0%.
  const tolerance = 1.5;
  const matchFraction = Math.max(0, 1 - (avgDistance / tolerance));
  const score = Math.round(matchFraction * 100);

  return score;
}
