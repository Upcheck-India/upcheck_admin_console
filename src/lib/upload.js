export const uploadFile = async (file) => {
  if (!file) {
    throw new Error('No file provided for upload.');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'File upload failed');
    }

    const data = await response.json();
    return data.filePath; // The API will return the path to the uploaded file
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};
