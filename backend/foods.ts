import { Controller, Get, Query, Module, Injectable } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

export interface FoodItem {
  id: string;
  name: string;
  regional_name?: string;
  category: string;
  gi_index: 'low' | 'medium' | 'high';
  gi_value: number;
  typical_portion_grams: number;
  carbs_per_100g: number;
  calories_per_100g: number;
  region?: string;
  notes?: string;
}

// 50 common Indian foods with GI values (sources: Glycemic Index Foundation, Indian diabetes studies)
export const INDIAN_FOODS: FoodItem[] = [
  // Grains & Breads
  { id: 'f001', name: 'Roti (wheat)', regional_name: 'Chapati', category: 'grains', gi_index: 'medium', gi_value: 62, typical_portion_grams: 40, carbs_per_100g: 52, calories_per_100g: 264 },
  { id: 'f002', name: 'White rice (cooked)', regional_name: 'Chawal', category: 'grains', gi_index: 'high', gi_value: 73, typical_portion_grams: 150, carbs_per_100g: 28, calories_per_100g: 130, notes: 'Cooling cooked rice increases resistant starch and lowers GI slightly' },
  { id: 'f003', name: 'Brown rice (cooked)', regional_name: 'Brown chawal', category: 'grains', gi_index: 'medium', gi_value: 55, typical_portion_grams: 150, carbs_per_100g: 23, calories_per_100g: 111 },
  { id: 'f004', name: 'Idli (plain)', regional_name: 'Idli', category: 'grains', gi_index: 'medium', gi_value: 54, typical_portion_grams: 80, carbs_per_100g: 22, calories_per_100g: 130, region: 'South India' },
  { id: 'f005', name: 'Dosa (plain)', regional_name: 'Dosa', category: 'grains', gi_index: 'medium', gi_value: 55, typical_portion_grams: 100, carbs_per_100g: 26, calories_per_100g: 168, region: 'South India' },
  { id: 'f006', name: 'Paratha (plain wheat)', regional_name: 'Paratha', category: 'grains', gi_index: 'medium', gi_value: 62, typical_portion_grams: 60, carbs_per_100g: 46, calories_per_100g: 320 },
  { id: 'f007', name: 'Poha (flattened rice)', regional_name: 'Poha / Chivda', category: 'grains', gi_index: 'medium', gi_value: 60, typical_portion_grams: 150, carbs_per_100g: 77, calories_per_100g: 370, region: 'Maharashtra / MP' },
  { id: 'f008', name: 'Upma (semolina)', regional_name: 'Upma', category: 'grains', gi_index: 'medium', gi_value: 65, typical_portion_grams: 150, carbs_per_100g: 22, calories_per_100g: 155, region: 'South India' },
  { id: 'f009', name: 'Khichdi (rice + moong dal)', regional_name: 'Khichdi', category: 'grains', gi_index: 'medium', gi_value: 58, typical_portion_grams: 200, carbs_per_100g: 18, calories_per_100g: 110 },
  { id: 'f010', name: 'Bajra roti (pearl millet)', regional_name: 'Bajra roti', category: 'grains', gi_index: 'low', gi_value: 45, typical_portion_grams: 40, carbs_per_100g: 67, calories_per_100g: 360, region: 'Rajasthan / Gujarat', notes: 'Lower GI than wheat roti — good alternative for diabetics' },
  { id: 'f011', name: 'Jowar roti (sorghum)', regional_name: 'Jowar roti', category: 'grains', gi_index: 'low', gi_value: 49, typical_portion_grams: 40, carbs_per_100g: 73, calories_per_100g: 329, region: 'Maharashtra / Deccan' },
  { id: 'f012', name: 'Ragi mudde (finger millet)', regional_name: 'Ragi mudde / Ragi roti', category: 'grains', gi_index: 'low', gi_value: 45, typical_portion_grams: 100, carbs_per_100g: 72, calories_per_100g: 328, region: 'Karnataka' },
  // Pulses & Legumes
  { id: 'f013', name: 'Dal (toor / arhar, cooked)', regional_name: 'Toor dal', category: 'pulses', gi_index: 'low', gi_value: 29, typical_portion_grams: 150, carbs_per_100g: 13, calories_per_100g: 93, notes: 'Excellent choice — low GI and high protein' },
  { id: 'f014', name: 'Dal (moong, cooked)', regional_name: 'Moong dal', category: 'pulses', gi_index: 'low', gi_value: 25, typical_portion_grams: 150, carbs_per_100g: 12, calories_per_100g: 105, notes: 'Very low GI — ideal first food in a meal to blunt glucose spike' },
  { id: 'f015', name: 'Chhole (chickpeas, cooked)', regional_name: 'Chhole / Chole', category: 'pulses', gi_index: 'low', gi_value: 28, typical_portion_grams: 150, carbs_per_100g: 27, calories_per_100g: 164 },
  { id: 'f016', name: 'Rajma (kidney beans, cooked)', regional_name: 'Rajma', category: 'pulses', gi_index: 'low', gi_value: 29, typical_portion_grams: 150, carbs_per_100g: 22, calories_per_100g: 127 },
  { id: 'f017', name: 'Sambar (lentil vegetable soup)', regional_name: 'Sambar', category: 'pulses', gi_index: 'low', gi_value: 30, typical_portion_grams: 200, carbs_per_100g: 8, calories_per_100g: 55, region: 'South India' },
  // Vegetables
  { id: 'f018', name: 'Sabzi (mixed vegetables, cooked)', regional_name: 'Sabzi', category: 'vegetables', gi_index: 'low', gi_value: 20, typical_portion_grams: 150, carbs_per_100g: 8, calories_per_100g: 50 },
  { id: 'f019', name: 'Bhindi (okra, cooked)', regional_name: 'Bhindi / Okra', category: 'vegetables', gi_index: 'low', gi_value: 20, typical_portion_grams: 100, carbs_per_100g: 7, calories_per_100g: 33, notes: 'Mucilage in okra helps slow sugar absorption' },
  { id: 'f020', name: 'Palak (spinach, cooked)', regional_name: 'Palak', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 3, calories_per_100g: 23 },
  { id: 'f021', name: 'Methi sabzi (fenugreek leaves)', regional_name: 'Methi', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 6, calories_per_100g: 49, notes: 'Fenugreek has proven blood sugar lowering properties' },
  { id: 'f022', name: 'Karela (bitter gourd, cooked)', regional_name: 'Karela', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 4, calories_per_100g: 17, notes: 'Contains compounds that mimic insulin action — beneficial for diabetics' },
  { id: 'f023', name: 'Potato (boiled)', regional_name: 'Aloo (ubla hua)', category: 'vegetables', gi_index: 'high', gi_value: 78, typical_portion_grams: 150, carbs_per_100g: 17, calories_per_100g: 77, notes: 'Cooling boiled potatoes reduces GI; avoid deep-fried preparations' },
  { id: 'f024', name: 'Sweet potato (boiled)', regional_name: 'Shakarkand', category: 'vegetables', gi_index: 'medium', gi_value: 54, typical_portion_grams: 150, carbs_per_100g: 20, calories_per_100g: 86 },
  // Dairy
  { id: 'f025', name: 'Curd / Dahi (plain, full-fat)', regional_name: 'Dahi', category: 'dairy', gi_index: 'low', gi_value: 33, typical_portion_grams: 150, carbs_per_100g: 3, calories_per_100g: 61, notes: 'Probiotic properties may help glucose metabolism' },
  { id: 'f026', name: 'Paneer (cottage cheese)', regional_name: 'Paneer', category: 'dairy', gi_index: 'low', gi_value: 27, typical_portion_grams: 100, carbs_per_100g: 3, calories_per_100g: 265 },
  { id: 'f027', name: 'Lassi (plain, unsweetened)', regional_name: 'Lassi', category: 'dairy', gi_index: 'low', gi_value: 35, typical_portion_grams: 250, carbs_per_100g: 5, calories_per_100g: 63 },
  { id: 'f028', name: 'Chai with milk (unsweetened)', regional_name: 'Dum chai', category: 'beverages', gi_index: 'low', gi_value: 30, typical_portion_grams: 150, carbs_per_100g: 5, calories_per_100g: 40, notes: 'Skip the sugar — spices like cinnamon may help insulin sensitivity' },
  // Snacks & Street food
  { id: 'f029', name: 'Biryani (chicken)', regional_name: 'Biryani', category: 'rice_dishes', gi_index: 'medium', gi_value: 58, typical_portion_grams: 300, carbs_per_100g: 24, calories_per_100g: 185, notes: 'Mixed rice dish — protein and fat blunt glucose spike vs plain rice' },
  { id: 'f030', name: 'Samosa (fried)', regional_name: 'Samosa', category: 'snacks', gi_index: 'high', gi_value: 70, typical_portion_grams: 80, carbs_per_100g: 40, calories_per_100g: 308, notes: 'Deep-fried; high GI and caloric density — occasional treat' },
  { id: 'f031', name: 'Puri (fried wheat bread)', regional_name: 'Puri', category: 'grains', gi_index: 'high', gi_value: 65, typical_portion_grams: 40, carbs_per_100g: 48, calories_per_100g: 412 },
  { id: 'f032', name: 'Dhokla (steamed gram flour)', regional_name: 'Dhokla', category: 'snacks', gi_index: 'medium', gi_value: 45, typical_portion_grams: 100, carbs_per_100g: 22, calories_per_100g: 160, region: 'Gujarat', notes: 'Fermented — lower GI than regular gram flour preparations' },
  { id: 'f033', name: 'Chaat (papri chaat)', regional_name: 'Chaat', category: 'snacks', gi_index: 'medium', gi_value: 60, typical_portion_grams: 150, carbs_per_100g: 32, calories_per_100g: 200 },
  // Fruits
  { id: 'f034', name: 'Banana', regional_name: 'Kela', category: 'fruits', gi_index: 'medium', gi_value: 51, typical_portion_grams: 120, carbs_per_100g: 23, calories_per_100g: 89, notes: 'Ripe bananas have higher GI; unripe ones are lower' },
  { id: 'f035', name: 'Mango', regional_name: 'Aam', category: 'fruits', gi_index: 'medium', gi_value: 56, typical_portion_grams: 150, carbs_per_100g: 15, calories_per_100g: 60, notes: 'Seasonal fruit; limit to small portions and eat with a meal' },
  { id: 'f036', name: 'Guava', regional_name: 'Amrood', category: 'fruits', gi_index: 'low', gi_value: 12, typical_portion_grams: 100, carbs_per_100g: 14, calories_per_100g: 68, notes: 'Very low GI — one of the best fruits for diabetics' },
  { id: 'f037', name: 'Papaya', regional_name: 'Papita', category: 'fruits', gi_index: 'medium', gi_value: 60, typical_portion_grams: 150, carbs_per_100g: 11, calories_per_100g: 43 },
  { id: 'f038', name: 'Apple', regional_name: 'Seb', category: 'fruits', gi_index: 'low', gi_value: 36, typical_portion_grams: 150, carbs_per_100g: 14, calories_per_100g: 52 },
  { id: 'f039', name: 'Pomegranate', regional_name: 'Anar', category: 'fruits', gi_index: 'low', gi_value: 35, typical_portion_grams: 100, carbs_per_100g: 19, calories_per_100g: 83, notes: 'Polyphenols may help reduce post-meal glucose spikes' },
  // Other dishes
  { id: 'f040', name: 'Egg (boiled)', regional_name: 'Anda (ubla hua)', category: 'protein', gi_index: 'low', gi_value: 0, typical_portion_grams: 60, carbs_per_100g: 1, calories_per_100g: 155, notes: 'Zero glycemic index — excellent protein source' },
  { id: 'f041', name: 'Chicken curry (with gravy)', regional_name: 'Murgh curry', category: 'protein', gi_index: 'low', gi_value: 20, typical_portion_grams: 200, carbs_per_100g: 5, calories_per_100g: 130 },
  { id: 'f042', name: 'Fish curry', regional_name: 'Machli curry', category: 'protein', gi_index: 'low', gi_value: 18, typical_portion_grams: 200, carbs_per_100g: 4, calories_per_100g: 110 },
  { id: 'f043', name: 'Chole bhature', regional_name: 'Chole bhature', category: 'grains', gi_index: 'high', gi_value: 70, typical_portion_grams: 350, carbs_per_100g: 38, calories_per_100g: 300, notes: 'Fried bread + chickpeas — high caloric density; limit portion size' },
  { id: 'f044', name: 'Dahi rice', regional_name: 'Curd rice / Thayir sadam', category: 'grains', gi_index: 'medium', gi_value: 55, typical_portion_grams: 200, carbs_per_100g: 22, calories_per_100g: 130, region: 'South India', notes: 'Yogurt lowers effective GI of rice' },
  { id: 'f045', name: 'Rasam', regional_name: 'Rasam', category: 'pulses', gi_index: 'low', gi_value: 25, typical_portion_grams: 150, carbs_per_100g: 5, calories_per_100g: 40, region: 'South India' },
  { id: 'f046', name: 'Uttapam', regional_name: 'Uttapam', category: 'grains', gi_index: 'medium', gi_value: 50, typical_portion_grams: 120, carbs_per_100g: 24, calories_per_100g: 145, region: 'South India' },
  { id: 'f047', name: 'Pongal (sweet)', regional_name: 'Sakkarai pongal', category: 'grains', gi_index: 'high', gi_value: 75, typical_portion_grams: 150, carbs_per_100g: 42, calories_per_100g: 200, region: 'Tamil Nadu', notes: 'High sugar + rice combination — avoid or have very small portions' },
  { id: 'f048', name: 'Halwa (suji/rava)', regional_name: 'Sooji halwa', category: 'sweets', gi_index: 'high', gi_value: 65, typical_portion_grams: 100, carbs_per_100g: 55, calories_per_100g: 350, notes: 'High GI sweet — occasional treat only' },
  { id: 'f049', name: 'Nuts (mixed: almonds, walnuts)', regional_name: 'Badam / Akhrot', category: 'snacks', gi_index: 'low', gi_value: 15, typical_portion_grams: 30, carbs_per_100g: 22, calories_per_100g: 607, notes: 'Healthy fats lower glucose response; good pre-meal or snack option' },
  { id: 'f050', name: 'Coconut chutney', regional_name: 'Nariyal chutney', category: 'condiments', gi_index: 'low', gi_value: 10, typical_portion_grams: 50, carbs_per_100g: 6, calories_per_100g: 280, region: 'South India' },
];

@Injectable()
export class FoodsService {
  search(query: string): FoodItem[] {
    if (!query || query.trim().length < 2) return INDIAN_FOODS.slice(0, 20);
    const q = query.toLowerCase().trim();
    return INDIAN_FOODS.filter(f =>
      f.name.toLowerCase().includes(q) ||
      (f.regional_name && f.regional_name.toLowerCase().includes(q)) ||
      f.category.toLowerCase().includes(q) ||
      (f.region && f.region.toLowerCase().includes(q))
    );
  }

  findById(id: string): FoodItem | undefined {
    return INDIAN_FOODS.find(f => f.id === id);
  }

  getAll(): FoodItem[] {
    return INDIAN_FOODS;
  }
}

@ApiTags('Indian Food Database')
@Controller('foods')
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all foods or search by name/category' })
  @ApiQuery({ name: 'query', required: false, description: 'Search term (e.g. roti, dal, biryani)' })
  search(@Query('query') query?: string) {
    return this.foodsService.search(query || '');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get food by ID' })
  findOne(@Query('id') id: string) {
    return this.foodsService.findById(id);
  }
}

@Module({
  controllers: [FoodsController],
  providers: [FoodsService],
  exports: [FoodsService],
})
export class FoodsModule {}
