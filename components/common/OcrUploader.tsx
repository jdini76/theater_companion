import React, { useState } from 'react';
import Tesseract from 'tesseract.js';

const OcrUploader: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
      setText('');
      setProgress(0);
    }
  };

  const handleOcr = async () => {
    if (!image) return;
    setLoading(true);
    setText('');
    setProgress(0);
    try {
      const { data } = await Tesseract.recognize(image, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      setText(data.text);
    } catch (err) {
      setText('Error during OCR.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto p-4 border rounded shadow bg-white">
      <h2 className="text-xl font-bold mb-2">OCR Uploader (Tesseract.js)</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} className="mb-2" />
      <button
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        onClick={handleOcr}
        disabled={!image || loading}
      >
        {loading ? 'Processing...' : 'Extract Text'}
      </button>
      {progress > 0 && loading && (
        <div className="mt-2">Progress: {progress}%</div>
      )}
      {text && (
        <textarea
          className="w-full mt-2 p-2 border rounded"
          rows={8}
          value={text}
          readOnly
        />
      )}
    </div>
  );
};

export default OcrUploader;
