# File Storage

## Frontend: Supabase Storage

### Create Bucket
1. Go to Supabase Console → Storage
2. Create bucket: `approval-files`
3. Settings:
   - Public: yes
   - File size: 10MB
   - Allowed: pdf, doc, docx, txt, png, jpg

### Upload Code
```tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

async function uploadFile(file: File) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${Math.random()}.${fileExt}`
  const filePath = `uploads/${fileName}`
  
  const { data, error } = await supabase.storage
    .from('approval-files')
    .upload(filePath, file)
    
  if (error) throw error
  
  const { data: { publicUrl } } = supabase.storage
    .from('approval-files')
    .getPublicUrl(filePath)
    
  return publicUrl
}
```

### Storage Policies

```sql
-- Allow authenticated uploads
CREATE POLICY "auth_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'approval-files');

-- Allow public read (for approvers with magic links)
CREATE POLICY "public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'approval-files');
```