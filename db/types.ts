export type Category = {
  id: number;
  name: string;
  icon_name: string;
  created_at: string;
};

export type Document = {
  id: number;
  category_id: number | null;
  title: string;
  file_uri: string;
  file_type: 'image' | 'pdf';
  purchase_price: number | null;
  expiry_date: string | null;
  notes: string | null;
  notification_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Setting = {
  key: string;
  value: string;
};
