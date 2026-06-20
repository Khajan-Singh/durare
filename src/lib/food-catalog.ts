// Hierarchical food catalog. Top-level key = overall category (e.g. "Produce").
// Second key = specific category / subcategory (e.g. "Fresh Fruits").
// Values are specific item names.
export const FOOD_CATALOG: Record<string, Record<string, string[]>> = {
  Produce: {
    "Fresh Fruits": ["Fuji Apple","Gala Apple","Granny Smith Apple","Honeycrisp Apple","Ripe Banana","Navel Orange","Blood Orange","Mandarin Clementines","Red Seedless Grapes","Green Seedless Grapes","Strawberries","Blueberries","Raspberries","Blackberries","Watermelon","Cantaloupe","Honeydew Melon","Ataulfo Mango","Tommy Atkins Mango","Bartlett Pear","Bosc Pear","Yellow Peach","White Nectarine","Bing Cherries","Black Plum","Pineapple","Papaya","Kiwi","Avocado","Lemon","Lime","Grapefruit"],
    "Fresh Vegetables": ["Broccoli Crown","Cauliflower","Baby Carrots","Whole Carrots","Russet Potato","Yukon Gold Potato","Sweet Potato","Red Onion","Yellow Onion","Shallots","Garlic","Cherry Tomatoes","Beefsteak Tomato","Roma Tomato","English Cucumber","Persian Cucumbers","Zucchini","Yellow Squash","Green Bell Pepper","Red Bell Pepper","Jalapeño","Serrano Pepper","Celery","Asparagus","Green Beans","Snow Peas","Sugar Snap Peas","Corn On The Cob","Eggplant","Brussels Sprouts"],
    "Leafy Greens": ["Baby Spinach","Arugula","Romaine Lettuce","Iceberg Lettuce","Butterhead Lettuce","Spring Mix","Kale","Lacinato Kale","Swiss Chard","Collard Greens","Mustard Greens","Bok Choy","Napa Cabbage","Green Cabbage","Red Cabbage","Endive","Radicchio","Watercress"],
    "Fresh Herbs": ["Basil","Cilantro","Flat Leaf Parsley","Curly Parsley","Dill","Tarragon","Thyme","Rosemary","Sage","Oregano","Mint","Chives","Lemongrass","Ginger Root","Turmeric Root"],
    "Mushrooms": ["White Button Mushrooms","Cremini Mushrooms","Portobello Mushrooms","Shiitake Mushrooms","Oyster Mushrooms","Maitake Mushrooms","Enoki Mushrooms","Lion's Mane Mushrooms"],
  },
  Dairy: {
    "Milk": ["Whole Milk","2% Reduced Fat Milk","1% Low Fat Milk","Skim Milk","Organic Whole Milk","Lactose Free Whole Milk","Fairlife Whole Milk","Half And Half","Heavy Whipping Cream","Light Cream","Buttermilk"],
    "Yogurt": ["Chobani Plain Greek Yogurt","Chobani Strawberry Greek Yogurt","Fage 0% Plain Greek Yogurt","Fage 2% Plain Greek Yogurt","Siggi's Vanilla Skyr","Oikos Triple Zero Vanilla","Stonyfield Organic Whole Milk Yogurt","Yoplait Original Strawberry","Noosa Honey Yoghurt","Two Good Strawberry Greek Yogurt","Activia Probiotic Peach Yogurt","Kite Hill Almond Milk Yogurt"],
    "Cheese": ["Sargento Mild Cheddar Slices","Kraft Sharp Cheddar Block","Tillamook Extra Sharp White Cheddar","Cabot Vermont Cheddar","BelGioioso Fresh Mozzarella","Galbani Whole Milk Mozzarella","Boar's Head Swiss","Jarlsberg Swiss","Laughing Cow Cream Cheese Wedges","Philadelphia Original Cream Cheese","Boursin Garlic Herb","Président Brie","Manchego Aged","Parmigiano Reggiano Wedge","Pecorino Romano","Feta Crumbled","Cotija","Queso Fresco"],
    "Butter": ["Land O Lakes Unsalted Butter","Kerrygold Pure Irish Butter","Plugrá European Style Butter","Challenge Salted Butter","Organic Valley Salted Butter","Country Crock Plant Butter","I Can't Believe It's Not Butter","Earth Balance Vegan Butter"],
    "Eggs": ["Large White Eggs 12ct","Large Brown Eggs 12ct","Jumbo Eggs 12ct","Cage Free Large Eggs","Free Range Eggs","Pasture Raised Eggs","Organic Large Brown Eggs","Pete And Gerry's Organic Eggs","Vital Farms Pasture Raised Eggs","Egg Whites Liquid Carton"],
  },
  "Meat & Seafood": {
    "Beef": ["80/20 Ground Beef","90/10 Lean Ground Beef","Ground Sirloin","Ribeye Steak","New York Strip Steak","Sirloin Steak","Flank Steak","Skirt Steak","Chuck Roast","Beef Brisket","Short Ribs","Top Round Roast","Beef Stew Meat","T-Bone Steak"],
    "Pork": ["Pork Tenderloin","Pork Loin Chops","Baby Back Ribs","St Louis Ribs","Ground Pork","Pork Shoulder","Pork Belly","Italian Sausage Links","Breakfast Sausage Patties","Bratwurst","Chorizo"],
    "Poultry": ["Boneless Skinless Chicken Breasts","Bone-In Chicken Thighs","Chicken Drumsticks","Whole Chicken","Ground Turkey","Turkey Breast","Turkey Thighs","Whole Turkey","Duck Breast","Cornish Hen","Air Chilled Chicken Breasts","Organic Chicken Thighs"],
    "Seafood": ["Atlantic Salmon Fillet","Wild Caught Sockeye Salmon","Tilapia Fillet","Cod Fillet","Halibut Fillet","Mahi Mahi","Swordfish Steak","Large Shrimp 21/25","Jumbo Shrimp 16/20","Sea Scallops","Littleneck Clams","Mussels","Lobster Tail","Dungeness Crab","Ahi Tuna Steak","Rainbow Trout"],
    "Deli Meat": ["Boar's Head Honey Turkey","Boar's Head Roast Beef","Applegate Natural Turkey Breast","Oscar Mayer Deli Fresh Turkey","Hillshire Farm Smoked Ham","Columbus Italian Dry Salami","Genoa Salami","Pepperoni Slices","Prosciutto Di Parma","Black Forest Ham","Mortadella"],
  },
  Bakery: {
    "Bread": ["Wonder Classic White Bread","Dave's Killer Bread 21 Whole Grains","Nature's Own Honey Wheat","Pepperidge Farm Sourdough","Arnold Country White","Sara Lee Artesano","Franz Mountain White","Oroweat Whole Wheat","Ezekiel 4:9 Sprouted Bread","La Brea Bakery Take & Bake Baguette","Whole Foods 365 Multigrain"],
    "Pastry": ["Butter Croissant","Chocolate Croissant","Almond Croissant","Blueberry Muffin","Bran Muffin","Chocolate Chip Muffin","Glazed Donut","Cinnamon Roll","Danish Pastry","Scone","Kouign Amann","Pain Au Chocolat"],
    "Cake": ["Chocolate Layer Cake","Vanilla Birthday Cake","Carrot Cake","Red Velvet Cake","Cheesecake Slice","Tiramisu","Lemon Pound Cake","Angel Food Cake","Tres Leches Cake","Bundt Cake"],
    "Bagels": ["Thomas' Plain Bagels","Thomas' Everything Bagels","Thomas' Blueberry Bagels","Dave's Killer Bagels Epic Everything","Pepperidge Farm Bagel Thins","Lender's Sesame Bagels","New York Style Poppy Seed Bagel","Asiago Cheese Bagel"],
  },
  Frozen: {
    "Frozen Vegetables": ["Birds Eye Frozen Broccoli","Birds Eye Frozen Mixed Vegetables","Green Giant Frozen Peas","Green Giant Corn","Cascadian Farm Edamame","Alexia Sweet Potato Fries","Ore-Ida Golden Fries","Birds Eye Riced Cauliflower","Frozen Spinach","Frozen Stir Fry Blend"],
    "Frozen Meals": ["Amy's Cheese Enchiladas","Amy's Black Bean Burrito","Lean Cuisine Chicken Tikka Masala","Healthy Choice Power Bowl","Stouffer's Lasagna","Stouffer's Mac And Cheese","Marie Callender's Pot Pie","Trader Joe's Mandarin Orange Chicken","Devour Buffalo Chicken Mac","Saffron Road Lamb Saag","Evol Truffle Parmesan Mac","Rao's Chicken Parmigiana"],
    "Frozen Pizza": ["DiGiorno Rising Crust Pepperoni","DiGiorno Four Cheese","Red Baron Classic Pepperoni","Tombstone Original Sausage","Newman's Own Thin Crust Margherita","Amy's Cheese Pizza","California Pizza Kitchen BBQ Chicken","Screamin' Sicilian Bessie's Revenge","Freschetta Brick Oven 5 Cheese","Caulipower Veggie Pizza"],
    "Ice Cream": ["Ben & Jerry's Chocolate Chip Cookie Dough","Ben & Jerry's Cherry Garcia","Häagen-Dazs Vanilla","Häagen-Dazs Strawberry","Breyers Natural Vanilla","Tillamook Mudslide","Talenti Gelato Sea Salt Caramel","Arctic Zero Chocolate","So Delicious Dairy Free Coconut Milk","Oat Dream Oatmilk Ice Cream"],
  },
  Snacks: {
    "Chips": ["Lay's Classic Potato Chips","Lay's Wavy Original","Ruffles Original","Pringles Original","Pringles Sour Cream & Onion","Doritos Nacho Cheese","Doritos Cool Ranch","Tostitos Scoops","Kettle Brand Sea Salt","Cape Cod Original","Siete Lime Grain Free","Popchips Original","Baked Lay's Original"],
    "Crackers": ["Ritz Original Crackers","Triscuit Original","Wheat Thins Original","Cheez-It Original","Goldfish Cheddar","Keebler Club Crackers","Carr's Table Water Crackers","Wasa Crispbread Sourdough","Stacy's Pita Chips Sea Salt","Simple Mills Almond Flour Crackers","Mary's Gone Crackers Original"],
    "Candy": ["Snickers Bar","Twix Bar","Kit Kat","Reese's Peanut Butter Cups","M&M's Milk Chocolate","M&M's Peanut","Starburst Original","Skittles Original","Haribo Goldbears","Trolli Sour Brite Crawlers","Jolly Rancher Hard Candy","Werther's Original","Lifesavers Wint-O-Green"],
    "Chocolate": ["Lindt Excellence 70% Dark","Lindt Lindor Milk Chocolate Truffles","Ghirardelli Intense Dark 72%","Ghirardelli Milk Chocolate Sea Salt","Green & Black's Organic Dark 70%","Theo Pure 85% Dark Chocolate","Endangered Species Dark Chocolate","Tony's Chocolonely Milk Chocolate","Hershey's Milk Chocolate Bar","Hershey's Cookies'N'Creme"],
    "Cookies": ["Oreo Original","Oreo Double Stuf","Chips Ahoy! Original","Pepperidge Farm Milano","Pepperidge Farm Sausalito","Nilla Wafers","Lorna Doone Shortbread","Biscoff Cookies","Tate's Chocolate Chip","Partake Chocolate Chip (Allergen Free)","Trader Joe's Joe-Joe's"],
    "Granola Bars": ["Kind Dark Chocolate Nuts & Sea Salt","Kind Almond & Coconut","Clif Bar Chocolate Chip","Clif Bar Crunchy Peanut Butter","Lärabar Apple Pie","Lärabar Peanut Butter Cookie","RxBar Chocolate Sea Salt","RxBar Blueberry","Nature Valley Oats & Honey","Quaker Chewy Chocolate Chip","Perfect Bar Dark Chocolate Chip Peanut Butter"],
    "Popcorn": ["Orville Redenbacher's Movie Theater Butter","Act II Butter Lovers","Skinny Pop Original","Skinny Pop White Cheddar","Boom Chicka Pop Sea Salt","Angie's Boomchickapop Sweet & Salty Kettle","Smartfood White Cheddar","Pop Secret Homestyle"],
    "Nuts & Seeds": ["Planters Dry Roasted Peanuts","Planters Mixed Nuts","Blue Diamond Almonds Sea Salt","Wonderful Pistachios No Shell","Fisher Walnuts","Diamond Pecans","Cashew Halves & Pieces","Sunflower Seeds","Pepitas","Trader Joe's Roasted Almonds","Justin's Honey Peanut Butter Packs"],
  },
  Beverages: {
    "Water": ["Evian Natural Spring Water","Fiji Natural Artesian Water","Smartwater Still","Dasani Purified Water","Poland Spring Sparkling","LaCroix Sparkling Lime","LaCroix Sparkling Coconut","Spindrift Lemon Sparkling","Topo Chico Mineral Water","Liquid Death Mountain Water"],
    "Juice": ["Tropicana Pure Premium Orange Juice","Simply Orange","Minute Maid Lemonade","Welch's Concord Grape Juice","Ocean Spray Cranberry Juice Cocktail","Naked Juice Green Machine","Odwalla Orange Juice","Bolthouse Farms Carrot Juice","Apple & Eve Apple Juice","Juicy Juice Berry"],
    "Soda": ["Coca-Cola Classic","Coca-Cola Zero Sugar","Diet Coke","Pepsi Original","Pepsi Zero Sugar","Dr Pepper","Dr Pepper Zero","Sprite","Mountain Dew","Fanta Orange","7UP","Canada Dry Ginger Ale","A&W Root Beer","Barq's Root Beer"],
    "Coffee": ["Starbucks Pike Place Ground Coffee","Starbucks Blonde Roast","Folgers Classic Roast","Maxwell House Original","Death Wish Coffee Ground","Lavazza Super Crema Espresso","Peet's Major Dickason's Blend","Eight O'Clock Original Blend","Stok Cold Brew Coffee","Chameleon Organic Cold Brew","La Colombe Draft Latte"],
    "Tea": ["Lipton Yellow Label Tea Bags","Bigelow Classic Green Tea","Celestial Seasonings Sleepytime","Tazo Chai Tea Bags","Yogi Honey Lavender Stress Relief","Traditional Medicinals Throat Coat","Harney & Sons Hot Cinnamon Spice","Twinings English Breakfast","Gold Peak Sweet Tea","Pure Leaf Unsweetened Green Tea","Snapple Peach Tea"],
    "Sports Drinks": ["Gatorade Thirst Quencher Fruit Punch","Gatorade Cool Blue","Powerade Mountain Berry Blast","Powerade Zero Fruit Punch","Bodyarmor Lyte Peach Mango","Liquid IV Hydration Lemon Lime","Nuun Sport Lemon Lime","Propel Lemon Water"],
    "Energy Drinks": ["Red Bull Original","Red Bull Sugar Free","Monster Energy Original","Monster Ultra White","Celsius Live Fit Sparkling Orange","Reign Total Body Fuel Lemon HDZ","Bang Energy Cotton Candy","Rockstar Original","NOS High Performance Energy"],
    "Plant-Based Milk": ["Oatly Oat Milk Original","Oatly Oat Milk Barista Edition","Silk Oat Yeah Plain","Planet Oat Extra Creamy Oatmilk","Califia Farms Oat Barista Blend","Almond Breeze Original Unsweetened","Silk Unsweetened Almond Milk","Ripple Unsweetened Pea Milk","So Delicious Organic Coconut Milk","Elmhurst Unsweetened Oat Milk"],
  },
  "Canned & Jarred": {
    "Canned Vegetables": ["Del Monte Sweet Peas","Green Giant Cut Green Beans","Del Monte Golden Corn","Hunt's Diced Tomatoes","Ro*Tel Original Diced Tomatoes & Green Chilies","Muir Glen Organic Fire Roasted Tomatoes","Libby's 100% Pure Pumpkin","Bush's Best Original Baked Beans","Goya Black Beans","Amy's Organic Lentil Soup"],
    "Canned Fish": ["StarKist Chunk Light Tuna In Water","StarKist Solid White Albacore","Bumble Bee Chunk Light Tuna","Wild Planet Wild Albacore Tuna","Chicken Of The Sea Pink Salmon","Crown Prince Smoked Oysters","Bar Harbor Clam Chowder","Bumble Bee Lemon Pepper Tuna Pouch"],
    "Sauces": ["Rao's Homemade Marinara Sauce","Prego Traditional Italian Sauce","Classico Tomato Basil","Barilla Roasted Garlic Sauce","Newman's Own Vodka Sauce","Bertolli Alfredo Sauce","Kinder's Teriyaki Sauce","San-J Tamari Soy Sauce","Huy Fong Sriracha","Frank's RedHot Original"],
    "Condiments": ["Heinz Tomato Ketchup","French's Classic Yellow Mustard","Grey Poupon Dijon Mustard","Hellmann's Real Mayonnaise","Best Foods Light Mayonnaise","Miracle Whip Original","Primal Kitchen Avocado Oil Mayo","Annie's Organic Ketchup","Sir Kensington's Classic Ketchup","Cholula Original Hot Sauce","Tabasco Original Red Sauce","Sweet Baby Ray's Barbecue Sauce"],
    "Pickles & Olives": ["Vlasic Original Dill Pickles","Claussen Kosher Dill Spears","Mt. Olive Bread And Butter Chips","Wickles Original Pickles","Mezzetta Castelvetrano Whole Olives","Lindsay Pitted Ripe Olives","Mario Green Salad Olives","DeLallo Marinated Artichoke Hearts","Peperoncini","Peppadew Piquanté Peppers"],
    "Soups": ["Campbell's Tomato Soup","Campbell's Chicken Noodle Soup","Progresso Chicken Noodle","Progresso Light Vegetable","Amy's Chunky Tomato Bisque","Pacific Foods Organic Creamy Tomato","Wolfgang Puck Chicken & Dumpling","Kettle & Fire Bone Broth Chicken","Imagine Organic Butternut Squash Soup","College Inn Chicken Broth"],
  },
  "Grains & Pasta": {
    "Pasta": ["Barilla Spaghetti","Barilla Penne Rigate","Barilla Rotini","Barilla Farfalle","De Cecco Rigatoni","De Cecco Fusilli","Banza Chickpea Penne","Explore Cuisine Edamame Fettuccine","Jovial Gluten-Free Brown Rice Penne","Tinkyada Brown Rice Spaghetti","Rao's Homemade Penne","Ancient Harvest Quinoa Pasta Rotelle"],
    "Rice": ["Lundberg Organic Long Grain White Rice","Nishiki Medium Grain Rice","Uncle Ben's Original Converted Rice","Mahatma Long Grain Rice","RiceSelect Texmati Long Grain Brown Rice","Lotus Foods Jasmine Rice","Dynasty Jasmine Rice","Botan Calrose Rice","Success Boil-In-Bag Brown Rice","Ben's Original Ready Rice Roasted Chicken"],
    "Cereal": ["Cheerios Original","Honey Nut Cheerios","Frosted Flakes","Kellogg's Raisin Bran","Special K Original","Life Original","Cap'N Crunch Original","Froot Loops","Cocoa Puffs","Kashi Go Lean","Nature's Path Flax Plus","Bob's Red Mill Muesli","Granola With Oats Honey & Raisins"],
    "Oats": ["Quaker Old Fashioned Oats","Quaker Quick 1-Minute Oats","Bob's Red Mill Organic Rolled Oats","Bob's Red Mill Steel Cut Oats","Nature's Path Organic Instant Oatmeal","Better Oats Instant Oatmeal Maple Brown Sugar","Trader Joe's Rolled Oats"],
    "Flour": ["King Arthur All-Purpose Flour","King Arthur Bread Flour","Gold Medal All-Purpose Flour","Bob's Red Mill Whole Wheat Flour","Arrowhead Mills Organic Whole Grain Spelt Flour","Bob's Red Mill Almond Flour","Anthony's Coconut Flour","Cup4Cup Multipurpose Gluten Free Flour"],
    "Quinoa & Grains": ["Ancient Harvest Organic Quinoa","Bob's Red Mill Tri-Color Quinoa","Goya Dried Lentils","Bob's Red Mill Red Lentils","Arrowhead Mills Organic Buckwheat Groats","Bob's Red Mill Farro","Seeds Of Change Organic Quinoa & Brown Rice","Near East Pearled Couscous","Bob's Red Mill Millet","Pocono Cream Of Buckwheat"],
  },
  "Peanut Butter & Spreads": {
    "Peanut Butter": ["Jif Creamy Peanut Butter","Jif Crunchy Peanut Butter","Skippy Creamy Peanut Butter","Peter Pan Creamy Honey Roast","Justin's Classic Almond Butter","Barney Butter Smooth Almond Butter","Once Again Organic Sunflower Seed Butter","Wowbutter Soy Nut Butter","Smucker's Natural Creamy Peanut Butter","Crazy Richard's Peanut Butter"],
    "Jams & Jellies": ["Smucker's Strawberry Jam","Smucker's Grape Jelly","Welch's Grape Jam","Bonne Maman Strawberry Preserves","Bonne Maman Apricot Preserves","Crofter's Organic Superfruit Spread","Polaner All Fruit Strawberry","Hero Raspberry Jam","Nutella Hazelnut Spread","Justin's Chocolate Almond Butter"],
  },
  "Baby & Infant": {
    "Baby Food": ["Gerber 1St Foods Sweet Potato Puree","Gerber 1St Foods Pea Puree","Happy Baby Organics Clearly Crafted Sweet Potato","Happy Baby Puffs Sweet Potato","Plum Organics Stage 2 Apple Butternut","Earth's Best Organic Banana Mango","Beech-Nut Naturals Apple","Sprout Organic Power Pak","Once Upon A Farm Mighty Morning"],
    "Baby Formula": ["Similac Advance Infant Formula","Enfamil Neuropro Infant Formula","Gerber Good Start Gentle","Earth's Best Organic Infant Formula","Similac Pro-Sensitive Non-Gmo","Enfamil Gentlease","Parent's Choice Advantage Infant Formula"],
  },
  "Dressings & Dips": {
    "Salad Dressing": ["Hidden Valley Original Ranch","Ken's Steakhouse Caesar","Newman's Own Balsamic Vinaigrette","Primal Kitchen Avocado Oil Ranch","Kraft Thousand Island","Wish-Bone Italian","Annie's Organic Goddess Dressing","Tessemae's Lemon Garlic","Bolthouse Farms Yogurt Dressing Ranch","Brianna's Blush Wine Vinaigrette"],
    "Hummus & Dips": ["Sabra Classic Hummus","Sabra Roasted Red Pepper Hummus","Cedar's Original Hummus","Hope Foods Organic Original Hummus","Ithaca Lemon Dill Hummus","Good Foods Chunky Guacamole","Wholly Guacamole Classic","Tribe Mediterranean Hummus","Heluva Good French Onion Dip","Tostitos Chunky Salsa Medium"],
  },
  "Cooking Oils & Vinegars": {
    "Cooking Oil": ["Crisco Pure Vegetable Oil","Wesson Canola Oil","Spectrum Naturals Organic Refined Coconut Oil","California Olive Ranch Everyday Extra Virgin Olive Oil","Primal Kitchen Extra Virgin Avocado Oil","La Tourangelle Toasted Sesame Oil","Chosen Foods Avocado Oil Spray","Pam Original Cooking Spray"],
    "Vinegar": ["Heinz Apple Cider Vinegar","Bragg Organic Apple Cider Vinegar","Pompeian Organic Red Wine Vinegar","Colavita White Balsamic Vinegar","Modena Balsamic Vinegar Of Modena","Marukan Rice Vinegar","Eden Organic Brown Rice Vinegar","Heinz White Vinegar"],
  },
  "Spices & Seasonings": {
    "Spices": ["McCormick Black Pepper","McCormick Garlic Powder","McCormick Onion Powder","McCormick Paprika","McCormick Cumin","McCormick Chili Powder","McCormick Oregano","McCormick Cinnamon","McCormick Turmeric","Lawry's Seasoned Salt","Morton Iodized Salt","Diamond Crystal Kosher Salt","Morton Sea Salt"],
    "Baking Supplies": ["Domino Granulated White Sugar","C&H Pure Cane Sugar","Domino Light Brown Sugar","Domino Powdered Sugar","Imperial Pure Cane Sugar","Clabber Girl Baking Powder","Arm & Hammer Baking Soda","Fleischmann's Rapid Rise Yeast","Toll House Semi-Sweet Chocolate Chips","Guittard Dark Chocolate Chips","Pure Vanilla Extract","Mccormick Cream Of Tartar"],
  },
  "Plant-Based & Health": {
    "Plant-Based Meat": ["Beyond Burger Patties","Beyond Sausage Brat Original","Impossible Burger Ground","Impossible Sausage Links","Lightlife Smart Dogs","Tofurky Italian Sausage","MorningStar Farms Veggie Burgers","Boca Original Vegan Burger","Field Roast Smoked Apple Sage Sausage","Gardein Ultimate Plant-Based Burger"],
    "Tofu & Tempeh": ["Nasoya Extra Firm Tofu","Nasoya Silken Tofu","House Foods Firm Tofu","Mori-Nu Silken Tofu Firm","Lightlife Original Tempeh","Lightlife Three Grain Tempeh","Trader Joe's Organic High Protein Tofu"],
    "Protein Supplements": ["Optimum Nutrition Gold Standard Whey Vanilla","Garden Of Life Sport Organic Vanilla","Orgain Organic Protein Powder Chocolate","Vega Sport Premium Protein Vanilla","Premier Protein Chocolate Shake","Fairlife Core Power 26G Protein","OWYN Only What You Need Plant Protein Shake"],
  },
  "Prepared & Deli": {
    "Prepared Salads": ["Fresh Express Caesar Salad Kit","Fresh Express Southwest Salad Kit","Dole Chopped Sesame Asian Salad Kit","Taylor Farms Chopped Asian Salad","Eat Smart Vegetable Crunch Salad","Gotham Greens Classic Caesar","Ready Pac Bistro Chef Salad"],
    "Prepared Meals": ["Rotisserie Chicken","Pulled Pork","Macaroni And Cheese","Mashed Potatoes","Chicken Soup","Beef Pot Roast","Sushi Rolls Assorted","Spring Rolls","Tamales","Enchiladas"],
  },
};

export const OVERALL_CATEGORIES = Object.keys(FOOD_CATALOG);

export function subcategoriesFor(overall: string): string[] {
  return Object.keys(FOOD_CATALOG[overall] ?? {});
}

export function itemsFor(overall: string, sub: string): string[] {
  return FOOD_CATALOG[overall]?.[sub] ?? [];
}

export function itemsForOverall(overall: string): string[] {
  const subs = FOOD_CATALOG[overall];
  if (!subs) return [];
  const all = new Set<string>();
  for (const list of Object.values(subs)) for (const name of list) all.add(name);
  return Array.from(all).sort();
}