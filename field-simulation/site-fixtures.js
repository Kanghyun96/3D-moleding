// One source of truth for visible fixtures and their physical collision bases.
// radius below is the LIGHT POOL in photo pixels, not the pole's physical size.
export const POLE_CLEARANCE=.35; // 0.12 m base radius + 0.23 m driving clearance
export const STREET_LIGHTS=[
  {id:'north-road',p:[446,130],radius:56},
  {id:'x-gate',p:[211,258],radius:49},
  {id:'west-road',p:[79,377],radius:56},
  {id:'southwest-road',p:[306,526],radius:53},
  {id:'south-road',p:[563,689],radius:55},
  {id:'southeast-road',p:[927,683],radius:57},
  {id:'east-road',p:[1100,478],radius:48},
  {id:'garage-apron',p:[925,354],radius:61},
  {id:'office-apron',p:[804,440],radius:47},
];
