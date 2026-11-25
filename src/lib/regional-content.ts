export interface RegionalObject {
  id: string;
  label: string;
  imageUrl: string;
}

export interface RegionalEnvironment {
  hydration: string;
  nutrition: string;
  exercise: string;
  morningRoutine: string;
}

export interface ContentPack {
  id: string;
  regionName: string;
  state: string;
  environments: RegionalEnvironment;
  cognitiveObjects: RegionalObject[];
}

export const NER_ASSAM_PACK: ContentPack = {
  id: 'ner-as-01',
  regionName: 'North East Region',
  state: 'Assam',
  environments: {
    hydration: '/assets/ner/river.svg',
    nutrition: '/assets/ner/tea-garden.svg',
    exercise: '/assets/ner/exercise.svg',
    morningRoutine: '/assets/ner/morning-light.svg',
  },
  cognitiveObjects: [
    { id: 'tea', label: 'Tea', imageUrl: '/assets/ner/tea.svg' },
    { id: 'bamboo', label: 'Bamboo', imageUrl: '/assets/ner/bamboo.svg' },
    { id: 'spice', label: 'Spices', imageUrl: '/assets/ner/spice.svg' },
    { id: 'rice', label: 'Rice', imageUrl: '/assets/ner/rice.svg' },
    { id: 'lantern', label: 'Lantern', imageUrl: '/assets/ner/lantern.svg' },
    { id: 'basket', label: 'Basket', imageUrl: '/assets/ner/basket.svg' },
    { id: 'rhino', label: 'Rhinoceros', imageUrl: '/assets/ner/rhino.svg' },
    { id: 'handloom', label: 'Handloom', imageUrl: '/assets/ner/handloom.svg' },
  ],
};

export const NER_REGIONAL_PACKS: ContentPack[] = [
  NER_ASSAM_PACK,
  {
    id: 'ner-ml-01',
    regionName: 'Khasi & Garo Hills',
    state: 'Meghalaya',
    environments: {
      hydration: '/assets/ner/river.svg',
      nutrition: '/assets/ner/spice.svg',
      exercise: '/assets/ner/root-bridge.svg',
      morningRoutine: '/assets/ner/morning-light.svg',
    },
    cognitiveObjects: [
      { id: 'root-bridge', label: 'Root Bridge', imageUrl: '/assets/ner/root-bridge.svg' },
      { id: 'bamboo', label: 'Bamboo', imageUrl: '/assets/ner/bamboo.svg' },
      { id: 'spice', label: 'Spices', imageUrl: '/assets/ner/spice.svg' },
      { id: 'basket', label: 'Basket', imageUrl: '/assets/ner/basket.svg' },
      { id: 'pineapple', label: 'Pineapple', imageUrl: '/assets/ner/pineapple.svg' },
      { id: 'tea', label: 'Tea', imageUrl: '/assets/ner/tea.svg' },
    ],
  },
  {
    id: 'ner-mn-01',
    regionName: 'Imphal Valley & Hills',
    state: 'Manipur',
    environments: {
      hydration: '/assets/ner/phumdi.svg',
      nutrition: '/assets/ner/rice.svg',
      exercise: '/assets/ner/exercise.svg',
      morningRoutine: '/assets/ner/morning-light.svg',
    },
    cognitiveObjects: [
      { id: 'phumdi', label: 'Loktak Phumdi', imageUrl: '/assets/ner/phumdi.svg' },
      { id: 'handloom', label: 'Handloom', imageUrl: '/assets/ner/handloom.svg' },
      { id: 'rice', label: 'Rice', imageUrl: '/assets/ner/rice.svg' },
      { id: 'basket', label: 'Basket', imageUrl: '/assets/ner/basket.svg' },
      { id: 'lantern', label: 'Lantern', imageUrl: '/assets/ner/lantern.svg' },
      { id: 'festival', label: 'Festival', imageUrl: '/assets/ner/festival.svg' },
    ],
  },
  {
    id: 'ner-nl-01',
    regionName: 'Naga Hills',
    state: 'Nagaland',
    environments: {
      hydration: '/assets/ner/river.svg',
      nutrition: '/assets/ner/rice.svg',
      exercise: '/assets/ner/exercise.svg',
      morningRoutine: '/assets/ner/morning-light.svg',
    },
    cognitiveObjects: [
      { id: 'shawl', label: 'Woven Shawl', imageUrl: '/assets/ner/shawl.svg' },
      { id: 'hornbill', label: 'Hornbill', imageUrl: '/assets/ner/hornbill.svg' },
      { id: 'bamboo', label: 'Bamboo', imageUrl: '/assets/ner/bamboo.svg' },
      { id: 'basket', label: 'Basket', imageUrl: '/assets/ner/basket.svg' },
      { id: 'spice', label: 'Spices', imageUrl: '/assets/ner/spice.svg' },
      { id: 'rice', label: 'Rice', imageUrl: '/assets/ner/rice.svg' },
    ],
  },
  {
    id: 'ner-mz-01',
    regionName: 'Lushai Hills',
    state: 'Mizoram',
    environments: {
      hydration: '/assets/ner/river.svg',
      nutrition: '/assets/ner/rice.svg',
      exercise: '/assets/ner/cheraw.svg',
      morningRoutine: '/assets/ner/morning-light.svg',
    },
    cognitiveObjects: [
      { id: 'cheraw', label: 'Bamboo Craft', imageUrl: '/assets/ner/cheraw.svg' },
      { id: 'shawl', label: 'Puan Weave', imageUrl: '/assets/ner/shawl.svg' },
      { id: 'bamboo', label: 'Bamboo', imageUrl: '/assets/ner/bamboo.svg' },
      { id: 'tea', label: 'Tea', imageUrl: '/assets/ner/tea.svg' },
      { id: 'basket', label: 'Basket', imageUrl: '/assets/ner/basket.svg' },
      { id: 'lantern', label: 'Lantern', imageUrl: '/assets/ner/lantern.svg' },
    ],
  },
  {
    id: 'ner-ar-01',
    regionName: 'Eastern Himalayas',
    state: 'Arunachal Pradesh',
    environments: {
      hydration: '/assets/ner/river.svg',
      nutrition: '/assets/ner/rice.svg',
      exercise: '/assets/ner/hornbill.svg',
      morningRoutine: '/assets/ner/morning-light.svg',
    },
    cognitiveObjects: [
      { id: 'hornbill', label: 'Hornbill', imageUrl: '/assets/ner/hornbill.svg' },
      { id: 'monastery', label: 'Monastery', imageUrl: '/assets/ner/monastery.svg' },
      { id: 'bamboo', label: 'Bamboo', imageUrl: '/assets/ner/bamboo.svg' },
      { id: 'handloom', label: 'Handloom', imageUrl: '/assets/ner/handloom.svg' },
      { id: 'rice', label: 'Rice', imageUrl: '/assets/ner/rice.svg' },
      { id: 'tea', label: 'Tea', imageUrl: '/assets/ner/tea.svg' },
    ],
  },
  {
    id: 'ner-tr-01',
    regionName: 'Tripura Valleys',
    state: 'Tripura',
    environments: {
      hydration: '/assets/ner/river.svg',
      nutrition: '/assets/ner/pineapple.svg',
      exercise: '/assets/ner/exercise.svg',
      morningRoutine: '/assets/ner/morning-light.svg',
    },
    cognitiveObjects: [
      { id: 'pineapple', label: 'Queen Pineapple', imageUrl: '/assets/ner/pineapple.svg' },
      { id: 'handloom', label: 'Risa Handloom', imageUrl: '/assets/ner/handloom.svg' },
      { id: 'bamboo', label: 'Bamboo', imageUrl: '/assets/ner/bamboo.svg' },
      { id: 'rice', label: 'Rice', imageUrl: '/assets/ner/rice.svg' },
      { id: 'tea', label: 'Tea', imageUrl: '/assets/ner/tea.svg' },
      { id: 'festival', label: 'Festival', imageUrl: '/assets/ner/festival.svg' },
    ],
  },
  {
    id: 'ner-sk-01',
    regionName: 'Sikkim Himalayas',
    state: 'Sikkim',
    environments: {
      hydration: '/assets/ner/river.svg',
      nutrition: '/assets/ner/tea-garden.svg',
      exercise: '/assets/ner/exercise.svg',
      morningRoutine: '/assets/ner/monastery.svg',
    },
    cognitiveObjects: [
      { id: 'monastery', label: 'Monastery', imageUrl: '/assets/ner/monastery.svg' },
      { id: 'tea', label: 'Temi Tea', imageUrl: '/assets/ner/tea.svg' },
      { id: 'spice', label: 'Cardamom', imageUrl: '/assets/ner/spice.svg' },
      { id: 'lantern', label: 'Butter Lamp', imageUrl: '/assets/ner/lantern.svg' },
      { id: 'rice', label: 'Rice', imageUrl: '/assets/ner/rice.svg' },
      { id: 'basket', label: 'Basket', imageUrl: '/assets/ner/basket.svg' },
    ],
  },
];

export function getCulturalPack(packId?: string | null): ContentPack {
  return NER_REGIONAL_PACKS.find((p) => p.id === packId) || NER_ASSAM_PACK;
}
