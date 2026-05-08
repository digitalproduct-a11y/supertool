// Static suggestion lists ported from the working mockup. Client-side
// substring filter is enough — the editor knows what they want; we just
// help with spelling and discovery.

export const FOOD_SUGGESTIONS = [
  'nasi lemak', 'nasi ayam', 'nasi goreng', 'nasi kandar', 'nasi briyani',
  'nasi kerabu', 'nasi dagang', 'nasi campur', 'nasi padang',
  'wantan mee', 'char kway teow', 'mee goreng', 'pan mee', 'hokkien mee',
  'curry mee', 'bak chor mee', 'beef noodles', 'pork noodles',
  'fish ball noodles', 'lor mee', 'mee siam', 'mee rebus', 'mee jawa',
  'asam laksa', 'curry laksa', 'laksa', 'kuey teow soup',
  'roti canai', 'roti tisu', 'roti bom', 'roti john', 'roti planta',
  'dim sum', 'chicken rice', 'fried rice', 'char siu', 'roast duck',
  'roast pork', 'siu yuk', 'bak kut teh', 'claypot rice', 'claypot chicken',
  'wonton soup', 'yong tau foo', 'kway chap', 'hor fun',
  'banana leaf rice', 'thosai', 'idli', 'putu mayam', 'mee mamak',
  'rojak', 'cendol', 'ais kacang', 'satay', 'apam balik', 'kuih',
  'mee hoon kueh', 'lemang', 'ketupat',
  'tom yam', 'tomyam', 'pizza', 'burger', 'steak', 'pasta', 'sushi', 'ramen',
] as const

export const LOCATION_SUGGESTIONS = [
  'Kuala Lumpur', 'KL', 'Bukit Bintang', 'KLCC', 'Bangsar', 'Bangsar South',
  'Mont Kiara', 'Sri Hartamas', 'Cheras', 'Setapak', 'Wangsa Maju', 'Sentul',
  'Ampang', 'Pandan Indah', 'Pandan Jaya', 'Brickfields', 'KL Sentral',
  'Mid Valley', 'Jalan Alor', 'Chinatown', 'Kampung Baru', 'Titiwangsa',
  'Old Klang Road', 'Taman Desa', 'Jalan Ipoh',
  'Petaling Jaya', 'PJ', 'SS 2', 'SS 14', 'SS 15', 'Section 14', 'Section 17',
  'Section 19', 'Damansara', 'Damansara Utama', 'Damansara Heights',
  'Damansara Perdana', 'Mutiara Damansara', 'Kota Damansara', 'TTDI',
  'Bandar Utama', 'Tropicana', 'Kelana Jaya', 'Sea Park', 'Kerinchi',
  'Subang Jaya', 'Subang', 'USJ', 'USJ 1', 'USJ 9', 'USJ 19', 'USJ 21',
  'SS 15 Subang', 'Sunway', 'Bandar Sunway',
  'Puchong', 'Kinrara', 'Bandar Puchong Jaya', 'IOI Puchong',
  'Bukit Jalil', 'Sri Petaling', 'Sungai Besi', 'Salak South',
  'Kajang', 'Semenyih', 'Bangi',
  'Shah Alam', 'Klang', 'Port Klang', 'Setia Alam', 'Glenmarie',
  'Cyberjaya', 'Putrajaya', 'Selayang', 'Gombak', 'Rawang',
  'Penang', 'George Town', 'Bayan Lepas', 'Tanjung Bungah', 'Batu Ferringhi',
  'Johor Bahru', 'JB', 'Iskandar Puteri',
  'Ipoh', 'Melaka', 'Malacca', 'Kuching', 'Kota Kinabalu',
  'Klang Valley', 'Greater KL',
] as const
