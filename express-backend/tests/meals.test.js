const { calculateGlycemicMetrics } = require('../utils/glycemicCalculator');

describe('Glycemic Calculator Utility', () => {

  it('should return default metrics for empty or missing foods', () => {
    const result1 = calculateGlycemicMetrics([]);
    expect(result1.estimatedCarbLoad).toBe(0);
    expect(result1.glycemicImpact).toBe('low');
    expect(result1.foodTags).toEqual([]);

    const result2 = calculateGlycemicMetrics(null);
    expect(result2.estimatedCarbLoad).toBe(0);
  });

  it('should calculate correct metrics for a single food item', () => {
    const foods = [{
      name: 'Toor Dal',
      carbsPerServing: 22,
      glycemicIndex: 29,
      tags: ['low-gi', 'high-protein']
    }];

    const result = calculateGlycemicMetrics(foods);
    expect(result.estimatedCarbLoad).toBe(22);
    expect(result.glycemicImpact).toBe('low'); // GI 29 <= 55
    expect(result.foodTags).toContain('low-gi');
    expect(result.foodTags).toContain('high-protein');
  });

  it('should calculate a weighted average GI correctly for multiple foods', () => {
    // Food 1: 45g carbs, GI 73 (High)
    // Food 2: 22g carbs, GI 29 (Low)
    // Weighted GI = ((45 * 73) + (22 * 29)) / (45 + 22) 
    //             = (3285 + 638) / 67 
    //             = 3923 / 67 ≈ 58.55 (Medium)
    
    const foods = [
      { name: 'White Rice', carbsPerServing: 45, glycemicIndex: 73, tags: ['staple'] },
      { name: 'Toor Dal', carbsPerServing: 22, glycemicIndex: 29, tags: ['protein'] }
    ];

    const result = calculateGlycemicMetrics(foods);
    
    expect(result.estimatedCarbLoad).toBe(67);
    expect(result.glycemicImpact).toBe('medium'); // 58.55 is between 56 and 69
    expect(result.foodTags.length).toBe(2);
    expect(result.foodTags).toContain('staple');
    expect(result.foodTags).toContain('protein');
  });

  it('should deduplicate tags from multiple foods', () => {
    const foods = [
      { carbsPerServing: 10, glycemicIndex: 50, tags: ['vegetarian', 'low-gi'] },
      { carbsPerServing: 15, glycemicIndex: 40, tags: ['vegetarian', 'high-fiber'] }
    ];

    const result = calculateGlycemicMetrics(foods);
    expect(result.foodTags.length).toBe(3);
    expect(result.foodTags.sort()).toEqual(['high-fiber', 'low-gi', 'vegetarian'].sort());
  });

  it('should handle foods with 0 carbs gracefully', () => {
    const foods = [
      { carbsPerServing: 0, glycemicIndex: 0, tags: ['water'] },
      { carbsPerServing: 20, glycemicIndex: 80, tags: ['sweet'] }
    ];

    const result = calculateGlycemicMetrics(foods);
    // The water shouldn't affect the weighted GI
    expect(result.estimatedCarbLoad).toBe(20);
    expect(result.glycemicImpact).toBe('high'); // 80 is high
  });

});
