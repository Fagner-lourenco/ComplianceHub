import { describe, expect, it } from 'vitest';

describe('Escavador2 async reset field contract', () => {
  it('documents async fields that must be cleared on correction and rerun', () => {
    const requiredFields = [
      'escavador2TaskId',
      'escavador2CallbackStatus',
      'escavador2DedupeDateToleranceDays',
    ];

    expect(requiredFields).toEqual([
      'escavador2TaskId',
      'escavador2CallbackStatus',
      'escavador2DedupeDateToleranceDays',
    ]);
  });
});
