export type Category = {
  id: number;
  name: string;
  created_at: string;
};

export type Prompt = {
  id: number;
  category_id: number | null;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};
