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
  // Grains & Breads (extended)
  { id: 'f051', name: 'Naan (plain)', category: 'grains', gi_index: 'high', gi_value: 71, typical_portion_grams: 90, carbs_per_100g: 50, calories_per_100g: 310 },
  { id: 'f052', name: 'Kulcha', category: 'grains', gi_index: 'high', gi_value: 72, typical_portion_grams: 80, carbs_per_100g: 49, calories_per_100g: 300, region: 'Punjab' },
  { id: 'f053', name: 'Tandoori roti', category: 'grains', gi_index: 'medium', gi_value: 68, typical_portion_grams: 40, carbs_per_100g: 50, calories_per_100g: 260 },
  { id: 'f054', name: 'Missi roti', regional_name: 'Missi roti', category: 'grains', gi_index: 'low', gi_value: 52, typical_portion_grams: 40, carbs_per_100g: 45, calories_per_100g: 280, region: 'Punjab / Rajasthan', notes: 'Gram flour blended with wheat lowers GI vs plain wheat roti' },
  { id: 'f055', name: 'Thepla (fenugreek flatbread)', regional_name: 'Thepla', category: 'grains', gi_index: 'medium', gi_value: 58, typical_portion_grams: 40, carbs_per_100g: 44, calories_per_100g: 270, region: 'Gujarat' },
  { id: 'f056', name: 'Akki roti (rice flour)', regional_name: 'Akki roti', category: 'grains', gi_index: 'high', gi_value: 75, typical_portion_grams: 60, carbs_per_100g: 58, calories_per_100g: 310, region: 'Karnataka' },
  { id: 'f057', name: 'Appam', category: 'grains', gi_index: 'medium', gi_value: 59, typical_portion_grams: 80, carbs_per_100g: 28, calories_per_100g: 180, region: 'Kerala' },
  { id: 'f058', name: 'Puttu (steamed rice + coconut)', regional_name: 'Puttu', category: 'grains', gi_index: 'medium', gi_value: 60, typical_portion_grams: 150, carbs_per_100g: 30, calories_per_100g: 190, region: 'Kerala' },
  { id: 'f059', name: 'Neer dosa', category: 'grains', gi_index: 'medium', gi_value: 58, typical_portion_grams: 90, carbs_per_100g: 24, calories_per_100g: 150, region: 'Karnataka / Konkan' },
  { id: 'f060', name: 'Vermicelli upma (semiya)', regional_name: 'Semiya upma', category: 'grains', gi_index: 'medium', gi_value: 62, typical_portion_grams: 150, carbs_per_100g: 25, calories_per_100g: 165 },
  { id: 'f061', name: 'Semolina porridge', regional_name: 'Sooji porridge', category: 'grains', gi_index: 'medium', gi_value: 66, typical_portion_grams: 200, carbs_per_100g: 20, calories_per_100g: 120 },
  { id: 'f062', name: 'Multigrain roti', category: 'grains', gi_index: 'low', gi_value: 48, typical_portion_grams: 40, carbs_per_100g: 50, calories_per_100g: 270, notes: 'Blend of millets and wheat lowers GI vs plain wheat roti' },
  { id: 'f063', name: 'Amaranth roti', regional_name: 'Rajgira roti', category: 'grains', gi_index: 'low', gi_value: 45, typical_portion_grams: 40, carbs_per_100g: 63, calories_per_100g: 310 },
  { id: 'f064', name: 'Buckwheat roti', regional_name: 'Kuttu ki roti', category: 'grains', gi_index: 'low', gi_value: 50, typical_portion_grams: 40, carbs_per_100g: 60, calories_per_100g: 305, notes: 'Common during religious fasting' },
  { id: 'f065', name: 'Sattu paratha', category: 'grains', gi_index: 'low', gi_value: 50, typical_portion_grams: 60, carbs_per_100g: 45, calories_per_100g: 290, region: 'Bihar' },
  { id: 'f066', name: 'Makki di roti (corn)', regional_name: 'Makki di roti', category: 'grains', gi_index: 'medium', gi_value: 69, typical_portion_grams: 50, carbs_per_100g: 55, calories_per_100g: 290, region: 'Punjab' },
  { id: 'f067', name: 'Rumali roti', category: 'grains', gi_index: 'high', gi_value: 75, typical_portion_grams: 30, carbs_per_100g: 50, calories_per_100g: 260 },
  { id: 'f068', name: 'Chilla (besan pancake)', regional_name: 'Besan chilla', category: 'grains', gi_index: 'low', gi_value: 42, typical_portion_grams: 80, carbs_per_100g: 30, calories_per_100g: 180, notes: 'Gram-flour based — good protein-to-carb ratio' },
  { id: 'f069', name: 'Pesarattu (moong dal dosa)', regional_name: 'Pesarattu', category: 'grains', gi_index: 'low', gi_value: 45, typical_portion_grams: 100, carbs_per_100g: 24, calories_per_100g: 160, region: 'Andhra Pradesh' },
  { id: 'f070', name: 'Set dosa', category: 'grains', gi_index: 'medium', gi_value: 56, typical_portion_grams: 100, carbs_per_100g: 27, calories_per_100g: 175, region: 'Karnataka' },
  { id: 'f071', name: 'Rava dosa', category: 'grains', gi_index: 'high', gi_value: 70, typical_portion_grams: 100, carbs_per_100g: 30, calories_per_100g: 200 },
  { id: 'f072', name: 'Malabar paratha', category: 'grains', gi_index: 'high', gi_value: 73, typical_portion_grams: 70, carbs_per_100g: 48, calories_per_100g: 330, region: 'Kerala' },
  { id: 'f073', name: 'Aloo paratha', category: 'grains', gi_index: 'medium', gi_value: 65, typical_portion_grams: 100, carbs_per_100g: 38, calories_per_100g: 260, notes: 'Potato stuffing raises GI vs plain paratha' },
  { id: 'f074', name: 'Gobi paratha', category: 'grains', gi_index: 'medium', gi_value: 58, typical_portion_grams: 100, carbs_per_100g: 30, calories_per_100g: 220 },
  { id: 'f075', name: 'Paneer paratha', category: 'grains', gi_index: 'low', gi_value: 52, typical_portion_grams: 100, carbs_per_100g: 28, calories_per_100g: 260, notes: "Paneer's protein and fat blunt the glucose response" },
  { id: 'f076', name: 'Muesli (unsweetened)', category: 'grains', gi_index: 'low', gi_value: 50, typical_portion_grams: 50, carbs_per_100g: 60, calories_per_100g: 360 },
  { id: 'f077', name: 'Cornflakes', category: 'grains', gi_index: 'high', gi_value: 81, typical_portion_grams: 30, carbs_per_100g: 84, calories_per_100g: 357, notes: 'Very high GI — a poor breakfast choice for diabetics despite being marketed as healthy' },
  { id: 'f078', name: 'Daliya (broken wheat porridge)', regional_name: 'Daliya', category: 'grains', gi_index: 'low', gi_value: 46, typical_portion_grams: 200, carbs_per_100g: 17, calories_per_100g: 90, notes: 'Good fiber-rich breakfast option' },
  // Pulses & Legumes (extended)
  { id: 'f079', name: 'Urad dal (cooked)', category: 'pulses', gi_index: 'low', gi_value: 32, typical_portion_grams: 150, carbs_per_100g: 15, calories_per_100g: 105 },
  { id: 'f080', name: 'Masoor dal (red lentil, cooked)', regional_name: 'Masoor dal', category: 'pulses', gi_index: 'low', gi_value: 29, typical_portion_grams: 150, carbs_per_100g: 14, calories_per_100g: 100 },
  { id: 'f081', name: 'Chana dal (split chickpea, cooked)', regional_name: 'Chana dal', category: 'pulses', gi_index: 'low', gi_value: 28, typical_portion_grams: 150, carbs_per_100g: 24, calories_per_100g: 145 },
  { id: 'f082', name: 'Lobia (black-eyed peas, cooked)', regional_name: 'Lobia', category: 'pulses', gi_index: 'low', gi_value: 33, typical_portion_grams: 150, carbs_per_100g: 20, calories_per_100g: 116 },
  { id: 'f083', name: 'Matki (moth beans, cooked)', regional_name: 'Matki', category: 'pulses', gi_index: 'low', gi_value: 30, typical_portion_grams: 150, carbs_per_100g: 21, calories_per_100g: 120, region: 'Maharashtra / Gujarat' },
  { id: 'f084', name: 'Val dal (field beans, cooked)', regional_name: 'Val dal', category: 'pulses', gi_index: 'low', gi_value: 31, typical_portion_grams: 150, carbs_per_100g: 19, calories_per_100g: 110, region: 'Gujarat' },
  { id: 'f085', name: 'Kala chana (black chickpeas, cooked)', regional_name: 'Kala chana', category: 'pulses', gi_index: 'low', gi_value: 30, typical_portion_grams: 150, carbs_per_100g: 22, calories_per_100g: 135 },
  { id: 'f086', name: 'Dal makhani', category: 'pulses', gi_index: 'low', gi_value: 35, typical_portion_grams: 200, carbs_per_100g: 15, calories_per_100g: 175, region: 'Punjab', notes: 'Cream and butter added, but the lentil base keeps GI relatively low' },
  { id: 'f087', name: 'Dal tadka', category: 'pulses', gi_index: 'low', gi_value: 30, typical_portion_grams: 200, carbs_per_100g: 14, calories_per_100g: 130 },
  { id: 'f088', name: 'Panchmel dal (five-lentil mix)', regional_name: 'Panchmel dal', category: 'pulses', gi_index: 'low', gi_value: 30, typical_portion_grams: 200, carbs_per_100g: 16, calories_per_100g: 140, region: 'Rajasthan' },
  { id: 'f089', name: 'Amti (sweet-sour dal)', regional_name: 'Amti', category: 'pulses', gi_index: 'low', gi_value: 32, typical_portion_grams: 200, carbs_per_100g: 18, calories_per_100g: 140, region: 'Maharashtra' },
  { id: 'f090', name: 'Cholar dal (sweet chana dal)', regional_name: 'Cholar dal', category: 'pulses', gi_index: 'medium', gi_value: 55, typical_portion_grams: 150, carbs_per_100g: 26, calories_per_100g: 160, region: 'West Bengal', notes: 'Jaggery/sugar added raises GI vs plain chana dal' },
  { id: 'f091', name: 'Dhokar dalna (lentil cake curry)', regional_name: 'Dhokar dalna', category: 'pulses', gi_index: 'medium', gi_value: 50, typical_portion_grams: 200, carbs_per_100g: 22, calories_per_100g: 180, region: 'West Bengal' },
  { id: 'f092', name: 'Sprouted moong salad', category: 'pulses', gi_index: 'low', gi_value: 25, typical_portion_grams: 100, carbs_per_100g: 7, calories_per_100g: 30, notes: 'Sprouting further lowers effective GI and boosts nutrient availability' },
  { id: 'f093', name: 'Rajma masala (gravy)', category: 'pulses', gi_index: 'low', gi_value: 32, typical_portion_grams: 200, carbs_per_100g: 20, calories_per_100g: 140 },
  { id: 'f094', name: 'Sundal (boiled legume snack)', regional_name: 'Sundal', category: 'pulses', gi_index: 'low', gi_value: 28, typical_portion_grams: 100, carbs_per_100g: 20, calories_per_100g: 130, region: 'Tamil Nadu' },
  { id: 'f095', name: 'Dal dhokli', category: 'pulses', gi_index: 'medium', gi_value: 55, typical_portion_grams: 200, carbs_per_100g: 30, calories_per_100g: 200, region: 'Gujarat', notes: 'Wheat dumplings in the dal raise GI vs plain dal' },
  { id: 'f096', name: 'Misal (sprouted moth bean curry)', regional_name: 'Misal', category: 'pulses', gi_index: 'low', gi_value: 35, typical_portion_grams: 200, carbs_per_100g: 22, calories_per_100g: 160, region: 'Maharashtra' },
  // Vegetables (extended)
  { id: 'f097', name: 'Baingan bharta', category: 'vegetables', gi_index: 'low', gi_value: 20, typical_portion_grams: 150, carbs_per_100g: 8, calories_per_100g: 65 },
  { id: 'f098', name: 'Aloo gobi', category: 'vegetables', gi_index: 'medium', gi_value: 56, typical_portion_grams: 150, carbs_per_100g: 15, calories_per_100g: 110 },
  { id: 'f099', name: 'Aloo matar', category: 'vegetables', gi_index: 'medium', gi_value: 54, typical_portion_grams: 150, carbs_per_100g: 16, calories_per_100g: 115 },
  { id: 'f100', name: 'Baingan fry (brinjal)', category: 'vegetables', gi_index: 'low', gi_value: 20, typical_portion_grams: 100, carbs_per_100g: 6, calories_per_100g: 60 },
  { id: 'f101', name: 'Cabbage sabzi', regional_name: 'Patta gobi sabzi', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 5, calories_per_100g: 35 },
  { id: 'f102', name: 'Cauliflower sabzi', regional_name: 'Gobi sabzi', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 5, calories_per_100g: 35 },
  { id: 'f103', name: 'Lauki sabzi (bottle gourd)', regional_name: 'Lauki', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 4, calories_per_100g: 25 },
  { id: 'f104', name: 'Tinda (apple gourd)', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 4, calories_per_100g: 28 },
  { id: 'f105', name: 'Parwal (pointed gourd)', category: 'vegetables', gi_index: 'low', gi_value: 18, typical_portion_grams: 100, carbs_per_100g: 5, calories_per_100g: 33 },
  { id: 'f106', name: 'Kaddu (pumpkin, cooked)', regional_name: 'Kaddu', category: 'vegetables', gi_index: 'high', gi_value: 75, typical_portion_grams: 100, carbs_per_100g: 7, calories_per_100g: 34, notes: 'High GI but low carb density per serving keeps the glycemic load low' },
  { id: 'f107', name: 'Capsicum sabzi', regional_name: 'Shimla mirch sabzi', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 5, calories_per_100g: 30 },
  { id: 'f108', name: 'Carrot sabzi', regional_name: 'Gajar sabzi', category: 'vegetables', gi_index: 'medium', gi_value: 47, typical_portion_grams: 100, carbs_per_100g: 8, calories_per_100g: 41 },
  { id: 'f109', name: 'Beetroot (cooked)', category: 'vegetables', gi_index: 'high', gi_value: 64, typical_portion_grams: 100, carbs_per_100g: 8, calories_per_100g: 44, notes: 'Moderate portions are fine — glycemic load is low for a typical serving' },
  { id: 'f110', name: 'Mooli sabzi (radish)', regional_name: 'Mooli sabzi', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 3, calories_per_100g: 18 },
  { id: 'f111', name: 'Kathal sabzi (jackfruit)', regional_name: 'Kathal', category: 'vegetables', gi_index: 'low', gi_value: 41, typical_portion_grams: 100, carbs_per_100g: 24, calories_per_100g: 95 },
  { id: 'f112', name: 'Arbi fry (colocasia)', regional_name: 'Arbi', category: 'vegetables', gi_index: 'medium', gi_value: 58, typical_portion_grams: 100, carbs_per_100g: 15, calories_per_100g: 80 },
  { id: 'f113', name: 'Suran sabzi (yam)', regional_name: 'Suran', category: 'vegetables', gi_index: 'medium', gi_value: 51, typical_portion_grams: 100, carbs_per_100g: 18, calories_per_100g: 97 },
  { id: 'f114', name: 'Tori sabzi (ridge gourd)', regional_name: 'Tori', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 4, calories_per_100g: 20 },
  { id: 'f115', name: 'Kundru sabzi (ivy gourd)', regional_name: 'Tindora sabzi', category: 'vegetables', gi_index: 'low', gi_value: 17, typical_portion_grams: 100, carbs_per_100g: 5, calories_per_100g: 34 },
  { id: 'f116', name: 'French beans sabzi', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 7, calories_per_100g: 31 },
  { id: 'f117', name: 'Cluster beans sabzi', regional_name: 'Gawar sabzi', category: 'vegetables', gi_index: 'low', gi_value: 20, typical_portion_grams: 100, carbs_per_100g: 7, calories_per_100g: 40, notes: 'Traditionally used to help support blood sugar regulation' },
  { id: 'f118', name: 'Drumstick sabzi (moringa)', regional_name: 'Sahjan sabzi', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 100, carbs_per_100g: 8, calories_per_100g: 37, notes: 'Moringa leaves and pods are linked to improved glucose metabolism in some studies' },
  { id: 'f119', name: 'Bhindi masala (dry)', category: 'vegetables', gi_index: 'low', gi_value: 20, typical_portion_grams: 100, carbs_per_100g: 7, calories_per_100g: 35 },
  { id: 'f120', name: 'Aloo bhindi', category: 'vegetables', gi_index: 'medium', gi_value: 55, typical_portion_grams: 150, carbs_per_100g: 14, calories_per_100g: 105 },
  { id: 'f121', name: 'Mixed vegetable curry', regional_name: 'Navratan-style curry', category: 'vegetables', gi_index: 'medium', gi_value: 48, typical_portion_grams: 200, carbs_per_100g: 14, calories_per_100g: 110 },
  { id: 'f122', name: 'Salad (cucumber, tomato, onion)', regional_name: 'Kachumber', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 150, carbs_per_100g: 5, calories_per_100g: 30, notes: 'Best eaten first in a meal to slow the subsequent glucose rise' },
  { id: 'f123', name: 'Green leafy mix', regional_name: 'Saag', category: 'vegetables', gi_index: 'low', gi_value: 15, typical_portion_grams: 150, carbs_per_100g: 6, calories_per_100g: 60, region: 'Punjab' },
  { id: 'f124', name: 'Baingan ka salan', category: 'vegetables', gi_index: 'low', gi_value: 25, typical_portion_grams: 150, carbs_per_100g: 9, calories_per_100g: 90, region: 'Hyderabad' },
  // Fruits (extended)
  { id: 'f125', name: 'Watermelon', category: 'fruits', gi_index: 'high', gi_value: 72, typical_portion_grams: 150, carbs_per_100g: 8, calories_per_100g: 30, notes: 'High GI but low carb density — a small portion keeps glycemic load low' },
  { id: 'f126', name: 'Muskmelon', regional_name: 'Kharbuja', category: 'fruits', gi_index: 'high', gi_value: 65, typical_portion_grams: 150, carbs_per_100g: 8, calories_per_100g: 34 },
  { id: 'f127', name: 'Grapes', category: 'fruits', gi_index: 'medium', gi_value: 53, typical_portion_grams: 100, carbs_per_100g: 16, calories_per_100g: 69 },
  { id: 'f128', name: 'Orange', category: 'fruits', gi_index: 'low', gi_value: 40, typical_portion_grams: 150, carbs_per_100g: 12, calories_per_100g: 47 },
  { id: 'f129', name: 'Sweet lime', regional_name: 'Mosambi', category: 'fruits', gi_index: 'low', gi_value: 43, typical_portion_grams: 150, carbs_per_100g: 10, calories_per_100g: 43 },
  { id: 'f130', name: 'Pineapple', category: 'fruits', gi_index: 'medium', gi_value: 59, typical_portion_grams: 100, carbs_per_100g: 13, calories_per_100g: 50 },
  { id: 'f131', name: 'Litchi', category: 'fruits', gi_index: 'medium', gi_value: 57, typical_portion_grams: 100, carbs_per_100g: 17, calories_per_100g: 66 },
  { id: 'f132', name: 'Chikoo', regional_name: 'Sapota', category: 'fruits', gi_index: 'medium', gi_value: 55, typical_portion_grams: 100, carbs_per_100g: 20, calories_per_100g: 83 },
  { id: 'f133', name: 'Custard apple', regional_name: 'Sitaphal', category: 'fruits', gi_index: 'medium', gi_value: 54, typical_portion_grams: 100, carbs_per_100g: 23, calories_per_100g: 94 },
  { id: 'f134', name: 'Jamun (Indian blackberry)', regional_name: 'Jamun', category: 'fruits', gi_index: 'low', gi_value: 25, typical_portion_grams: 100, carbs_per_100g: 14, calories_per_100g: 60, notes: 'Traditionally regarded as beneficial for blood sugar; seed extract studied for glucose-lowering effects' },
  { id: 'f135', name: 'Kiwi', category: 'fruits', gi_index: 'low', gi_value: 39, typical_portion_grams: 100, carbs_per_100g: 15, calories_per_100g: 61 },
  { id: 'f136', name: 'Strawberry', category: 'fruits', gi_index: 'low', gi_value: 40, typical_portion_grams: 100, carbs_per_100g: 8, calories_per_100g: 33 },
  { id: 'f137', name: 'Pear', regional_name: 'Nashpati', category: 'fruits', gi_index: 'low', gi_value: 38, typical_portion_grams: 150, carbs_per_100g: 15, calories_per_100g: 57 },
  { id: 'f138', name: 'Peach', regional_name: 'Aadu', category: 'fruits', gi_index: 'low', gi_value: 42, typical_portion_grams: 100, carbs_per_100g: 10, calories_per_100g: 39 },
  { id: 'f139', name: 'Plum', regional_name: 'Aloo bukhara', category: 'fruits', gi_index: 'low', gi_value: 40, typical_portion_grams: 100, carbs_per_100g: 11, calories_per_100g: 46 },
  { id: 'f140', name: 'Fig (fresh)', regional_name: 'Anjeer', category: 'fruits', gi_index: 'medium', gi_value: 61, typical_portion_grams: 60, carbs_per_100g: 19, calories_per_100g: 74 },
  { id: 'f141', name: 'Dates (dried)', regional_name: 'Khajoor', category: 'fruits', gi_index: 'high', gi_value: 62, typical_portion_grams: 20, carbs_per_100g: 75, calories_per_100g: 282, notes: 'Dried fruit — very calorie/carb dense, limit portion strictly' },
  { id: 'f142', name: 'Raisins', regional_name: 'Kishmish', category: 'fruits', gi_index: 'high', gi_value: 64, typical_portion_grams: 15, carbs_per_100g: 79, calories_per_100g: 299, notes: 'Concentrated sugars — small quantity only' },
  // Dairy (extended)
  { id: 'f143', name: 'Buttermilk (unsweetened)', regional_name: 'Chaas', category: 'dairy', gi_index: 'low', gi_value: 20, typical_portion_grams: 200, carbs_per_100g: 3, calories_per_100g: 25, notes: 'Excellent low-carb accompaniment to a meal' },
  { id: 'f144', name: 'Skimmed milk', category: 'dairy', gi_index: 'low', gi_value: 32, typical_portion_grams: 200, carbs_per_100g: 5, calories_per_100g: 42 },
  { id: 'f145', name: 'Full cream milk', category: 'dairy', gi_index: 'low', gi_value: 30, typical_portion_grams: 200, carbs_per_100g: 5, calories_per_100g: 61 },
  { id: 'f146', name: 'Greek yogurt (plain)', category: 'dairy', gi_index: 'low', gi_value: 20, typical_portion_grams: 150, carbs_per_100g: 4, calories_per_100g: 97, notes: 'Higher protein than regular curd — good satiety with minimal glucose impact' },
  { id: 'f147', name: 'Shrikhand', category: 'dairy', gi_index: 'high', gi_value: 70, typical_portion_grams: 100, carbs_per_100g: 30, calories_per_100g: 220, notes: 'Sweetened strained yogurt — high sugar, occasional treat only' },
  { id: 'f148', name: 'Khoya (reduced milk solids)', regional_name: 'Khoya', category: 'dairy', gi_index: 'medium', gi_value: 55, typical_portion_grams: 30, carbs_per_100g: 21, calories_per_100g: 150 },
  { id: 'f149', name: 'Ghee', category: 'dairy', gi_index: 'low', gi_value: 0, typical_portion_grams: 5, carbs_per_100g: 0, calories_per_100g: 45, notes: 'Pure fat with negligible carbs — calorie-dense, use sparingly' },
  { id: 'f150', name: 'Cheese (processed)', category: 'dairy', gi_index: 'low', gi_value: 27, typical_portion_grams: 20, carbs_per_100g: 1, calories_per_100g: 65 },
  { id: 'f151', name: 'Malai (clotted cream)', category: 'dairy', gi_index: 'low', gi_value: 20, typical_portion_grams: 20, carbs_per_100g: 2, calories_per_100g: 70 },
  { id: 'f152', name: 'Kadhi (yogurt-gram flour curry)', category: 'dairy', gi_index: 'low', gi_value: 35, typical_portion_grams: 200, carbs_per_100g: 12, calories_per_100g: 110, region: 'Gujarat / Rajasthan' },
  // Beverages (extended)
  { id: 'f153', name: 'Coconut water', category: 'beverages', gi_index: 'low', gi_value: 45, typical_portion_grams: 250, carbs_per_100g: 5, calories_per_100g: 19, notes: 'Electrolyte-rich and naturally low in sugar' },
  { id: 'f154', name: 'Nimbu pani (unsweetened)', regional_name: 'Nimbu pani', category: 'beverages', gi_index: 'low', gi_value: 5, typical_portion_grams: 250, carbs_per_100g: 1, calories_per_100g: 5 },
  { id: 'f155', name: 'Jaljeera', category: 'beverages', gi_index: 'low', gi_value: 20, typical_portion_grams: 200, carbs_per_100g: 4, calories_per_100g: 20 },
  { id: 'f156', name: 'Sugarcane juice', category: 'beverages', gi_index: 'high', gi_value: 68, typical_portion_grams: 200, carbs_per_100g: 27, calories_per_100g: 110, notes: 'Very high sugar content — avoid or strictly limit' },
  { id: 'f157', name: 'Filter coffee (unsweetened, with milk)', category: 'beverages', gi_index: 'low', gi_value: 30, typical_portion_grams: 150, carbs_per_100g: 4, calories_per_100g: 35, region: 'South India' },
  { id: 'f158', name: 'Green tea', category: 'beverages', gi_index: 'low', gi_value: 0, typical_portion_grams: 200, carbs_per_100g: 0, calories_per_100g: 2 },
  { id: 'f159', name: 'Masala chaas', category: 'beverages', gi_index: 'low', gi_value: 20, typical_portion_grams: 200, carbs_per_100g: 3, calories_per_100g: 30 },
  { id: 'f160', name: 'Badam milk (unsweetened)', category: 'beverages', gi_index: 'low', gi_value: 30, typical_portion_grams: 200, carbs_per_100g: 6, calories_per_100g: 90 },
  { id: 'f161', name: 'Fresh fruit juice (mixed, unsweetened)', category: 'beverages', gi_index: 'medium', gi_value: 55, typical_portion_grams: 200, carbs_per_100g: 20, calories_per_100g: 90, notes: 'Juicing removes the fiber that would otherwise slow sugar absorption — whole fruit is preferred' },
  { id: 'f162', name: 'Tender coconut malai', category: 'beverages', gi_index: 'low', gi_value: 25, typical_portion_grams: 50, carbs_per_100g: 5, calories_per_100g: 60 },
  // Rice Dishes (extended)
  { id: 'f163', name: 'Vegetable pulao', category: 'rice_dishes', gi_index: 'medium', gi_value: 60, typical_portion_grams: 250, carbs_per_100g: 26, calories_per_100g: 160 },
  { id: 'f164', name: 'Jeera rice', category: 'rice_dishes', gi_index: 'high', gi_value: 70, typical_portion_grams: 200, carbs_per_100g: 28, calories_per_100g: 150 },
  { id: 'f165', name: 'Lemon rice', category: 'rice_dishes', gi_index: 'medium', gi_value: 58, typical_portion_grams: 200, carbs_per_100g: 26, calories_per_100g: 155, region: 'South India' },
  { id: 'f166', name: 'Tamarind rice', regional_name: 'Puliyodarai', category: 'rice_dishes', gi_index: 'medium', gi_value: 55, typical_portion_grams: 200, carbs_per_100g: 27, calories_per_100g: 165, region: 'Tamil Nadu' },
  { id: 'f167', name: 'Bisi bele bath', category: 'rice_dishes', gi_index: 'medium', gi_value: 58, typical_portion_grams: 250, carbs_per_100g: 30, calories_per_100g: 190, region: 'Karnataka' },
  { id: 'f168', name: 'Mutton biryani', category: 'rice_dishes', gi_index: 'medium', gi_value: 60, typical_portion_grams: 300, carbs_per_100g: 25, calories_per_100g: 210 },
  { id: 'f169', name: 'Vegetable biryani', category: 'rice_dishes', gi_index: 'medium', gi_value: 62, typical_portion_grams: 300, carbs_per_100g: 27, calories_per_100g: 175 },
  { id: 'f170', name: 'Egg biryani', category: 'rice_dishes', gi_index: 'medium', gi_value: 59, typical_portion_grams: 300, carbs_per_100g: 24, calories_per_100g: 190 },
  { id: 'f171', name: 'Fish biryani', category: 'rice_dishes', gi_index: 'medium', gi_value: 57, typical_portion_grams: 300, carbs_per_100g: 23, calories_per_100g: 185, region: 'Kerala / Hyderabad' },
  { id: 'f172', name: 'Khichuri (Bengali-style)', regional_name: 'Khichuri', category: 'rice_dishes', gi_index: 'medium', gi_value: 56, typical_portion_grams: 250, carbs_per_100g: 24, calories_per_100g: 160, region: 'West Bengal / Odisha' },
  { id: 'f173', name: 'Pulao (peas)', regional_name: 'Matar pulao', category: 'rice_dishes', gi_index: 'medium', gi_value: 61, typical_portion_grams: 200, carbs_per_100g: 27, calories_per_100g: 160 },
  { id: 'f174', name: 'Fried rice (vegetable, Indo-Chinese)', category: 'rice_dishes', gi_index: 'high', gi_value: 71, typical_portion_grams: 250, carbs_per_100g: 30, calories_per_100g: 190 },
  { id: 'f175', name: 'Kanji (fermented rice water)', regional_name: 'Kanji', category: 'rice_dishes', gi_index: 'low', gi_value: 40, typical_portion_grams: 200, carbs_per_100g: 10, calories_per_100g: 45, region: 'Kerala' },
  { id: 'f176', name: 'Rice porridge', regional_name: 'Pazhaya sadam', category: 'rice_dishes', gi_index: 'medium', gi_value: 65, typical_portion_grams: 250, carbs_per_100g: 22, calories_per_100g: 120 },
  // Snacks & Street Food (extended)
  { id: 'f177', name: 'Pav bhaji', category: 'snacks', gi_index: 'high', gi_value: 70, typical_portion_grams: 250, carbs_per_100g: 35, calories_per_100g: 300, region: 'Maharashtra' },
  { id: 'f178', name: 'Vada pav', category: 'snacks', gi_index: 'high', gi_value: 73, typical_portion_grams: 150, carbs_per_100g: 40, calories_per_100g: 290, region: 'Maharashtra' },
  { id: 'f179', name: 'Bhel puri', category: 'snacks', gi_index: 'medium', gi_value: 60, typical_portion_grams: 150, carbs_per_100g: 28, calories_per_100g: 180 },
  { id: 'f180', name: 'Pani puri', category: 'snacks', gi_index: 'medium', gi_value: 55, typical_portion_grams: 100, carbs_per_100g: 22, calories_per_100g: 150 },
  { id: 'f181', name: 'Sev puri', category: 'snacks', gi_index: 'medium', gi_value: 58, typical_portion_grams: 150, carbs_per_100g: 30, calories_per_100g: 220 },
  { id: 'f182', name: 'Kachori', category: 'snacks', gi_index: 'high', gi_value: 72, typical_portion_grams: 60, carbs_per_100g: 35, calories_per_100g: 290 },
  { id: 'f183', name: 'Aloo tikki', category: 'snacks', gi_index: 'high', gi_value: 74, typical_portion_grams: 80, carbs_per_100g: 22, calories_per_100g: 180 },
  { id: 'f184', name: 'Momos (veg, steamed)', category: 'snacks', gi_index: 'medium', gi_value: 50, typical_portion_grams: 150, carbs_per_100g: 25, calories_per_100g: 160, region: 'North-East India' },
  { id: 'f185', name: 'Momos (chicken, steamed)', category: 'snacks', gi_index: 'medium', gi_value: 48, typical_portion_grams: 150, carbs_per_100g: 20, calories_per_100g: 175, region: 'North-East India' },
  { id: 'f186', name: 'Spring roll (veg)', category: 'snacks', gi_index: 'high', gi_value: 68, typical_portion_grams: 100, carbs_per_100g: 24, calories_per_100g: 210 },
  { id: 'f187', name: 'Bonda (potato)', category: 'snacks', gi_index: 'high', gi_value: 70, typical_portion_grams: 60, carbs_per_100g: 24, calories_per_100g: 200 },
  { id: 'f188', name: 'Vada (medu vada)', regional_name: 'Medu vada', category: 'snacks', gi_index: 'medium', gi_value: 55, typical_portion_grams: 60, carbs_per_100g: 18, calories_per_100g: 145, region: 'South India' },
  { id: 'f189', name: 'Idiyappam (string hoppers)', regional_name: 'Idiyappam', category: 'snacks', gi_index: 'medium', gi_value: 55, typical_portion_grams: 100, carbs_per_100g: 26, calories_per_100g: 150, region: 'Kerala / Tamil Nadu' },
  { id: 'f190', name: 'Murukku', category: 'snacks', gi_index: 'high', gi_value: 70, typical_portion_grams: 30, carbs_per_100g: 20, calories_per_100g: 155, region: 'South India' },
  { id: 'f191', name: 'Khakhra', category: 'snacks', gi_index: 'low', gi_value: 45, typical_portion_grams: 20, carbs_per_100g: 15, calories_per_100g: 90, region: 'Gujarat', notes: 'Baked, not fried — lighter snack option' },
  { id: 'f192', name: 'Handvo', category: 'snacks', gi_index: 'medium', gi_value: 55, typical_portion_grams: 100, carbs_per_100g: 22, calories_per_100g: 180, region: 'Gujarat' },
  { id: 'f193', name: 'Khaman', category: 'snacks', gi_index: 'medium', gi_value: 46, typical_portion_grams: 100, carbs_per_100g: 20, calories_per_100g: 150, region: 'Gujarat' },
  { id: 'f194', name: 'Fafda', category: 'snacks', gi_index: 'high', gi_value: 70, typical_portion_grams: 60, carbs_per_100g: 25, calories_per_100g: 260, region: 'Gujarat' },
  { id: 'f195', name: 'Papad (roasted)', category: 'snacks', gi_index: 'low', gi_value: 40, typical_portion_grams: 15, carbs_per_100g: 8, calories_per_100g: 55 },
  { id: 'f196', name: 'Papad (fried)', category: 'snacks', gi_index: 'medium', gi_value: 50, typical_portion_grams: 15, carbs_per_100g: 8, calories_per_100g: 75 },
  { id: 'f197', name: 'Namkeen mixture', category: 'snacks', gi_index: 'high', gi_value: 70, typical_portion_grams: 30, carbs_per_100g: 18, calories_per_100g: 160 },
  { id: 'f198', name: 'Bhujia (sev)', category: 'snacks', gi_index: 'high', gi_value: 68, typical_portion_grams: 30, carbs_per_100g: 16, calories_per_100g: 155 },
  { id: 'f199', name: 'Corn chaat (boiled)', category: 'snacks', gi_index: 'medium', gi_value: 52, typical_portion_grams: 100, carbs_per_100g: 19, calories_per_100g: 96, notes: 'Boiled, not fried — a better choice than most chaats' },
  { id: 'f200', name: 'Roasted chana', regional_name: 'Chana jor', category: 'snacks', gi_index: 'low', gi_value: 28, typical_portion_grams: 30, carbs_per_100g: 15, calories_per_100g: 110, notes: 'Roasted and unsalted — a high-fiber, low-GI snack' },
  { id: 'f201', name: 'Makhana (fox nuts, roasted)', category: 'snacks', gi_index: 'low', gi_value: 30, typical_portion_grams: 30, carbs_per_100g: 18, calories_per_100g: 105, notes: 'Low GI and high fiber — a good diabetic-friendly snack' },
  { id: 'f202', name: 'Popcorn (plain, no butter)', category: 'snacks', gi_index: 'medium', gi_value: 55, typical_portion_grams: 20, carbs_per_100g: 15, calories_per_100g: 90 },
  { id: 'f203', name: 'Dabeli', category: 'snacks', gi_index: 'high', gi_value: 68, typical_portion_grams: 120, carbs_per_100g: 32, calories_per_100g: 250, region: 'Gujarat' },
  { id: 'f204', name: 'Ragda pattice', category: 'snacks', gi_index: 'medium', gi_value: 58, typical_portion_grams: 200, carbs_per_100g: 30, calories_per_100g: 220, region: 'Maharashtra' },
  { id: 'f205', name: 'Kathi roll (paneer)', category: 'snacks', gi_index: 'medium', gi_value: 56, typical_portion_grams: 200, carbs_per_100g: 30, calories_per_100g: 320 },
  // Protein — non-veg & veg (extended)
  { id: 'f206', name: 'Mutton curry', category: 'protein', gi_index: 'low', gi_value: 15, typical_portion_grams: 200, carbs_per_100g: 6, calories_per_100g: 220 },
  { id: 'f207', name: 'Prawn curry', category: 'protein', gi_index: 'low', gi_value: 12, typical_portion_grams: 200, carbs_per_100g: 5, calories_per_100g: 165, region: 'Coastal India' },
  { id: 'f208', name: 'Tandoori chicken', category: 'protein', gi_index: 'low', gi_value: 0, typical_portion_grams: 150, carbs_per_100g: 2, calories_per_100g: 190 },
  { id: 'f209', name: 'Chicken tikka', category: 'protein', gi_index: 'low', gi_value: 0, typical_portion_grams: 150, carbs_per_100g: 3, calories_per_100g: 210 },
  { id: 'f210', name: 'Egg curry', category: 'protein', gi_index: 'low', gi_value: 20, typical_portion_grams: 200, carbs_per_100g: 8, calories_per_100g: 180 },
  { id: 'f211', name: 'Egg bhurji', category: 'protein', gi_index: 'low', gi_value: 5, typical_portion_grams: 150, carbs_per_100g: 3, calories_per_100g: 170 },
  { id: 'f212', name: 'Omelette (plain)', category: 'protein', gi_index: 'low', gi_value: 0, typical_portion_grams: 100, carbs_per_100g: 1, calories_per_100g: 154 },
  { id: 'f213', name: 'Kheema (minced meat curry)', category: 'protein', gi_index: 'low', gi_value: 18, typical_portion_grams: 200, carbs_per_100g: 7, calories_per_100g: 250 },
  { id: 'f214', name: 'Fish fry', category: 'protein', gi_index: 'low', gi_value: 30, typical_portion_grams: 150, carbs_per_100g: 6, calories_per_100g: 200 },
  { id: 'f215', name: 'Crab curry', category: 'protein', gi_index: 'low', gi_value: 15, typical_portion_grams: 200, carbs_per_100g: 6, calories_per_100g: 150, region: 'Coastal India' },
  { id: 'f216', name: 'Tofu bhurji', category: 'protein', gi_index: 'low', gi_value: 15, typical_portion_grams: 150, carbs_per_100g: 4, calories_per_100g: 130, notes: 'Plant-based, low-GI protein alternative' },
  { id: 'f217', name: 'Soya chunks curry', regional_name: 'Meal maker curry', category: 'protein', gi_index: 'low', gi_value: 20, typical_portion_grams: 150, carbs_per_100g: 9, calories_per_100g: 130, notes: 'Very high protein, low fat — good for blood-sugar-friendly meals' },
  { id: 'f218', name: 'Sprouts salad (mixed)', category: 'protein', gi_index: 'low', gi_value: 25, typical_portion_grams: 100, carbs_per_100g: 10, calories_per_100g: 80 },
  { id: 'f219', name: 'Chicken curry (dry, no gravy)', category: 'protein', gi_index: 'low', gi_value: 15, typical_portion_grams: 150, carbs_per_100g: 3, calories_per_100g: 195 },
  { id: 'f220', name: 'Seekh kebab', category: 'protein', gi_index: 'low', gi_value: 5, typical_portion_grams: 100, carbs_per_100g: 3, calories_per_100g: 210 },
  { id: 'f221', name: 'Fish tikka', category: 'protein', gi_index: 'low', gi_value: 5, typical_portion_grams: 150, carbs_per_100g: 3, calories_per_100g: 175 },
  { id: 'f222', name: 'Boiled chana chaat', category: 'protein', gi_index: 'low', gi_value: 28, typical_portion_grams: 150, carbs_per_100g: 22, calories_per_100g: 160 },
  { id: 'f223', name: 'Paneer tikka', category: 'protein', gi_index: 'low', gi_value: 10, typical_portion_grams: 150, carbs_per_100g: 5, calories_per_100g: 230 },
  { id: 'f224', name: 'Chicken stew', category: 'protein', gi_index: 'low', gi_value: 20, typical_portion_grams: 200, carbs_per_100g: 8, calories_per_100g: 180, region: 'Kerala' },
  { id: 'f225', name: 'Grilled fish (tandoori-style)', category: 'protein', gi_index: 'low', gi_value: 0, typical_portion_grams: 150, carbs_per_100g: 2, calories_per_100g: 180 },
  // Sweets (extended)
  { id: 'f226', name: 'Gulab jamun', category: 'sweets', gi_index: 'high', gi_value: 78, typical_portion_grams: 50, carbs_per_100g: 45, calories_per_100g: 175, notes: 'Deep-fried in sugar syrup — very high glycemic load, strictly occasional' },
  { id: 'f227', name: 'Jalebi', category: 'sweets', gi_index: 'high', gi_value: 80, typical_portion_grams: 40, carbs_per_100g: 45, calories_per_100g: 150, notes: 'Among the highest-GI Indian sweets — avoid or extremely limit' },
  { id: 'f228', name: 'Rasgulla', category: 'sweets', gi_index: 'medium', gi_value: 65, typical_portion_grams: 50, carbs_per_100g: 28, calories_per_100g: 120 },
  { id: 'f229', name: 'Rasmalai', category: 'sweets', gi_index: 'medium', gi_value: 62, typical_portion_grams: 60, carbs_per_100g: 25, calories_per_100g: 160 },
  { id: 'f230', name: 'Barfi (milk)', category: 'sweets', gi_index: 'high', gi_value: 70, typical_portion_grams: 30, carbs_per_100g: 22, calories_per_100g: 140 },
  { id: 'f231', name: 'Ladoo (besan)', category: 'sweets', gi_index: 'high', gi_value: 68, typical_portion_grams: 30, carbs_per_100g: 20, calories_per_100g: 150 },
  { id: 'f232', name: 'Ladoo (boondi)', category: 'sweets', gi_index: 'high', gi_value: 72, typical_portion_grams: 30, carbs_per_100g: 21, calories_per_100g: 155 },
  { id: 'f233', name: 'Kheer (rice pudding)', category: 'sweets', gi_index: 'high', gi_value: 75, typical_portion_grams: 100, carbs_per_100g: 18, calories_per_100g: 130 },
  { id: 'f234', name: 'Gajar ka halwa', category: 'sweets', gi_index: 'high', gi_value: 68, typical_portion_grams: 100, carbs_per_100g: 30, calories_per_100g: 220 },
  { id: 'f235', name: 'Kulfi', category: 'sweets', gi_index: 'medium', gi_value: 60, typical_portion_grams: 60, carbs_per_100g: 18, calories_per_100g: 140 },
  { id: 'f236', name: 'Mysore pak', category: 'sweets', gi_index: 'high', gi_value: 74, typical_portion_grams: 30, carbs_per_100g: 24, calories_per_100g: 180, region: 'Karnataka' },
  { id: 'f237', name: 'Sandesh', category: 'sweets', gi_index: 'medium', gi_value: 58, typical_portion_grams: 40, carbs_per_100g: 18, calories_per_100g: 110, region: 'West Bengal' },
  { id: 'f238', name: 'Modak', category: 'sweets', gi_index: 'high', gi_value: 70, typical_portion_grams: 40, carbs_per_100g: 22, calories_per_100g: 130, region: 'Maharashtra' },
  { id: 'f239', name: 'Peda', category: 'sweets', gi_index: 'high', gi_value: 68, typical_portion_grams: 25, carbs_per_100g: 15, calories_per_100g: 100 },
  { id: 'f240', name: 'Sugar-free sweet', category: 'sweets', gi_index: 'low', gi_value: 25, typical_portion_grams: 30, carbs_per_100g: 8, calories_per_100g: 60, notes: 'Best available option for a sweet craving — check which sweetener was actually used' },
  // Condiments & Others (extended)
  { id: 'f241', name: 'Mango pickle', regional_name: 'Aam achaar', category: 'condiments', gi_index: 'low', gi_value: 25, typical_portion_grams: 15, carbs_per_100g: 5, calories_per_100g: 35, notes: 'Oil and salt heavy — small quantity only' },
  { id: 'f242', name: 'Green chutney (mint-coriander)', category: 'condiments', gi_index: 'low', gi_value: 10, typical_portion_grams: 20, carbs_per_100g: 2, calories_per_100g: 15 },
  { id: 'f243', name: 'Tamarind chutney (sweet)', category: 'condiments', gi_index: 'medium', gi_value: 55, typical_portion_grams: 20, carbs_per_100g: 12, calories_per_100g: 50, notes: 'Contains jaggery/sugar — use sparingly' },
  { id: 'f244', name: 'Peanut chutney', category: 'condiments', gi_index: 'low', gi_value: 15, typical_portion_grams: 30, carbs_per_100g: 5, calories_per_100g: 90 },
  { id: 'f245', name: 'Tomato chutney', category: 'condiments', gi_index: 'low', gi_value: 30, typical_portion_grams: 30, carbs_per_100g: 6, calories_per_100g: 40 },
  { id: 'f246', name: 'Curry leaves powder', regional_name: 'Podi', category: 'condiments', gi_index: 'low', gi_value: 20, typical_portion_grams: 10, carbs_per_100g: 3, calories_per_100g: 45, region: 'South India' },
  { id: 'f247', name: 'Garlic chutney', category: 'condiments', gi_index: 'low', gi_value: 15, typical_portion_grams: 15, carbs_per_100g: 3, calories_per_100g: 40, region: 'Maharashtra' },
  { id: 'f248', name: 'Raita (cucumber-curd)', category: 'condiments', gi_index: 'low', gi_value: 25, typical_portion_grams: 100, carbs_per_100g: 5, calories_per_100g: 55, notes: 'Yogurt base helps blunt the overall meal GI' },
  { id: 'f249', name: 'Ginger-lemon pickle', category: 'condiments', gi_index: 'low', gi_value: 20, typical_portion_grams: 15, carbs_per_100g: 3, calories_per_100g: 20 },
  { id: 'f250', name: 'Til chutney (sesame)', category: 'condiments', gi_index: 'low', gi_value: 20, typical_portion_grams: 20, carbs_per_100g: 4, calories_per_100g: 95, region: 'Maharashtra' },
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
