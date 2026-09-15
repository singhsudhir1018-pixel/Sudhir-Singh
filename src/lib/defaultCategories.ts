import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';

export interface DefaultCategoryDef {
  name: string;
  type: 'EXPENSE' | 'INCOME' | 'INVENTORY';
  subCategories: string[];
}

export const DEFAULT_FARM_CATEGORIES: DefaultCategoryDef[] = [
  // EXPENSE CATEGORIES
  {
    name: 'Feed / दाना',
    type: 'EXPENSE',
    subCategories: ['Fish Feed 2mm', 'Fish Feed 4mm', 'Floating Feed', 'Layer Poultry Feed', 'Local Grain (मकै)']
  },
  {
    name: 'Medicine & Vaccine / औषधि तथा खोप',
    type: 'EXPENSE',
    subCategories: ['Vaccine', 'Vitamin C', 'Vitamin AD3E', 'Water Sanitizer', 'Antibiotics', 'Probiotics']
  },
  {
    name: 'Labour & Wages / मजदुरी तथा ज्याला',
    type: 'EXPENSE',
    subCategories: ['Daily Wages', 'Harvesting Labour', 'Pond Digging / माटो खन्ने', 'Night Guard']
  },
  {
    name: 'Equipment & Tools / औजार तथा उपकरण',
    type: 'EXPENSE',
    subCategories: ['Fishing Net', 'Water Pump Service', 'Aerator Spare Parts', 'Feeding Trays']
  },
  {
    name: 'Fuel & Transport / इन्धन तथा ढुवानी',
    type: 'EXPENSE',
    subCategories: ['Diesel', 'Petrol', 'Transport / भाडा', 'Vehicle Maintenance']
  },
  {
    name: 'Lease & Land Rent / जग्गा तथा पोखरी भाडा',
    type: 'EXPENSE',
    subCategories: ['Pond Lease', 'Land Rent']
  },
  {
    name: 'Electricity & Water / बिजुली तथा पानी',
    type: 'EXPENSE',
    subCategories: ['Electricity Bill', 'Water Supply Charge']
  },
  {
    name: 'Miscellaneous / विविध खर्च',
    type: 'EXPENSE',
    subCategories: ['Packaging', 'General Office', 'Refreshments / खाजा']
  },

  // INCOME CATEGORIES
  {
    name: 'Fish Sales / माछा बिक्री',
    type: 'INCOME',
    subCategories: ['Rohu Fish', 'Naini Fish', 'Common Carp', 'Grass Carp', 'Silver Carp', 'Pangasius']
  },
  {
    name: 'Livestock & Poultry / पशुपन्छी बिक्री',
    type: 'INCOME',
    subCategories: ['Broiler Chicken', 'Eggs / अण्डा', 'Goat / बाख्रा', 'Milk / दूध']
  },
  {
    name: 'Crops & Vegetables / बाली तथा तरकारी',
    type: 'INCOME',
    subCategories: ['Seasonal Vegetables', 'Grains / अन्न', 'Fruits / फलफूल']
  },
  {
    name: 'Partner Capital / साझेदार लगानी',
    type: 'INCOME',
    subCategories: ['Contribution', 'Initial Capital']
  },
  {
    name: 'Other Income / अन्य आम्दानी',
    type: 'INCOME',
    subCategories: ['Farm Tour / भिजिट', 'Manure / मल बिक्री', 'Government Subsidy / अनुदान']
  },

  // INVENTORY CATEGORIES
  {
    name: 'Feed / दाना',
    type: 'INVENTORY',
    subCategories: ['Fish Feed 2mm', 'Fish Feed 4mm', 'Floating Feed', 'Bran / ढुटो', 'Mustard Oil Cake / पिना']
  },
  {
    name: 'Medicine & Chemicals / औषधि तथा रसायन',
    type: 'INVENTORY',
    subCategories: ['Potassium Permanganate', 'Lime / चून', 'Vitamin Packets', 'Sanitizer']
  },
  {
    name: 'Farm Equipment / औजार तथा उपकरण',
    type: 'INVENTORY',
    subCategories: ['Paddle Wheel Aerator', 'Water Pump', 'Testing Kit', 'Drag Net']
  },
  {
    name: 'Packaging Materials / प्याकेजिङ',
    type: 'INVENTORY',
    subCategories: ['Plastic Crates', 'Fish Oxygen Bags', 'Feed Sacks']
  }
];

let isSeedingInProgress = false;

export async function seedDefaultCategoriesIfEmpty(farmId: string): Promise<boolean> {
  if (!farmId || isSeedingInProgress) return false;

  try {
    isSeedingInProgress = true;
    const catsQuery = query(collection(db, 'categories'), where('farmId', '==', farmId));
    const snap = await getDocs(catsQuery);

    if (snap.size > 0) {
      // Already has categories
      return false;
    }

    // Seed default categories and subcategories
    const batch = writeBatch(db);
    const catCol = collection(db, 'categories');
    const subCatCol = collection(db, 'subcategories');

    for (const item of DEFAULT_FARM_CATEGORIES) {
      const catRef = doc(catCol);
      batch.set(catRef, {
        farmId,
        name: item.name,
        type: item.type,
        createdAt: Date.now()
      });

      for (const subName of item.subCategories) {
        const subRef = doc(subCatCol);
        batch.set(subRef, {
          farmId,
          categoryId: catRef.id,
          name: subName,
          createdAt: Date.now()
        });
      }
    }

    await batch.commit();
    return true;
  } catch (err) {
    console.warn('Could not auto-seed categories:', err);
    return false;
  } finally {
    isSeedingInProgress = false;
  }
}
