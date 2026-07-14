import { FoodsService, INDIAN_FOODS } from './foods';

describe('FoodsService', () => {
  let service: FoodsService;

  beforeEach(() => {
    service = new FoodsService();
  });

  // ─── search ───────────────────────────────────────────────────────────────

  describe('search', () => {
    it('returns first 20 foods when query is empty', () => {
      const result = service.search('');
      expect(result).toHaveLength(20);
      expect(result).toEqual(INDIAN_FOODS.slice(0, 20));
    });

    it('returns first 20 foods when query is a single character (too short)', () => {
      const result = service.search('r');
      expect(result).toHaveLength(20);
    });

    it('finds roti by name', () => {
      const result = service.search('roti');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((f) => f.name.toLowerCase().includes('roti'))).toBe(true);
    });

    it('finds roti by regional name (chapati)', () => {
      const result = service.search('chapati');
      expect(result.length).toBeGreaterThan(0);
      expect(result.some((f) => f.regional_name?.toLowerCase().includes('chapati'))).toBe(true);
    });

    it('finds biryani and returns correct GI value', () => {
      const result = service.search('biryani');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].name).toBe('Biryani (chicken)');
      expect(result[0].gi_value).toBe(58);
      expect(result[0].gi_index).toBe('medium');
    });

    it('finds dal entries including low-GI toor dal and moong dal', () => {
      const result = service.search('dal');
      expect(result.length).toBeGreaterThanOrEqual(2);
      const lowGiDals = result.filter((f) => f.gi_index === 'low');
      expect(lowGiDals.length).toBeGreaterThanOrEqual(2);
      expect(result.some((f) => f.name.includes('toor') || f.regional_name?.includes('Toor'))).toBe(true);
    });

    it('finds upma and returns correct GI data', () => {
      const result = service.search('upma');
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].name).toBe('Upma (semolina)');
      expect(result[0].gi_value).toBe(65);
      expect(result[0].region).toBe('South India');
    });

    it('finds idli by name', () => {
      const result = service.search('idli');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].gi_index).toBe('medium');
    });

    it('finds dosa by name', () => {
      const result = service.search('dosa');
      expect(result.length).toBeGreaterThan(0);
    });

    it('searches by category — returns all pulses', () => {
      const result = service.search('pulses');
      expect(result.length).toBeGreaterThan(0);
      result.forEach((f) => expect(f.category).toBe('pulses'));
    });

    it('searches by region — returns South India items', () => {
      const result = service.search('South India');
      expect(result.length).toBeGreaterThan(0);
      result.forEach((f) => expect(f.region).toBe('South India'));
    });

    it('is case-insensitive', () => {
      const lower = service.search('biryani');
      const upper = service.search('BIRYANI');
      const mixed = service.search('BiRyAnI');
      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });

    it('returns empty array for a query with no matches', () => {
      const result = service.search('xyz-no-such-food-123');
      expect(result).toHaveLength(0);
    });

    it('returns empty array for a query matching nothing', () => {
      const result = service.search('burger');
      expect(result).toHaveLength(0);
    });

    it('finds rajma by name', () => {
      const result = service.search('rajma');
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].gi_index).toBe('low');
      expect(result[0].gi_value).toBe(29);
    });

    it('finds chole by regional name', () => {
      const result = service.search('chole');
      expect(result.length).toBeGreaterThan(0);
    });

    it('finds khichdi by name', () => {
      const result = service.search('khichdi');
      expect(result).toHaveLength(1);
      expect(result[0].gi_index).toBe('medium');
    });
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the food item for a valid ID', () => {
      const result = service.findById('f001');
      expect(result).toBeDefined();
      expect(result!.name).toBe('Roti (wheat)');
      expect(result!.gi_value).toBe(62);
    });

    it('returns food item for biryani (f029)', () => {
      const result = service.findById('f029');
      expect(result).toBeDefined();
      expect(result!.name).toBe('Biryani (chicken)');
    });

    it('returns undefined for a non-existent ID', () => {
      const result = service.findById('f999');
      expect(result).toBeUndefined();
    });

    it('returns undefined for an empty ID', () => {
      const result = service.findById('');
      expect(result).toBeUndefined();
    });
  });

  // ─── getAll ───────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns exactly 250 foods', () => {
      const result = service.getAll();
      expect(result).toHaveLength(250);
    });

    it('returns the same reference as INDIAN_FOODS', () => {
      const result = service.getAll();
      expect(result).toBe(INDIAN_FOODS);
    });

    it('every food item has required fields', () => {
      const result = service.getAll();
      result.forEach((f) => {
        expect(f.id).toBeDefined();
        expect(f.name).toBeDefined();
        expect(f.category).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(f.gi_index);
        expect(typeof f.gi_value).toBe('number');
        expect(typeof f.carbs_per_100g).toBe('number');
      });
    });

    it('all IDs are unique', () => {
      const result = service.getAll();
      const ids = result.map((f) => f.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });
});
