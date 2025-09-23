import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image as ImageIcon, X, Edit3 } from 'lucide-react';
import { useTransformation } from '../lib/stores/useTransformation';
import { ImageEditor } from './ImageEditor';

const UploadZone: React.FC = () => {
  const { 
    setUploadedImage, 
    uploadedImage, 
    originalImage,
    setOriginalImage,
    showImageEditor,
    setShowImageEditor,
    clearResults 
  } = useTransformation();
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    console.log('📁 File dropped:', file?.name, file?.type, file?.size);
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        console.log('📷 Image loaded as data URL, length:', result?.length);
        setOriginalImage(result); // Store original
        setUploadedImage(result); // Set as current uploaded image
        clearResults(); // Clear any previous results when new image is uploaded
        console.log('✅ Image state updated');
      };
      reader.readAsDataURL(file);
    } else {
      console.log('❌ Invalid file type or no file selected');
    }
  }, [setUploadedImage, clearResults]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  const removeImage = () => {
    setUploadedImage(null);
    setOriginalImage(null);
    clearResults();
  };

  const openEditor = () => {
    setShowImageEditor(true);
  };

  const handleEditorSave = (editedImage: string) => {
    setUploadedImage(editedImage);
    setOriginalImage(editedImage); // Update original so next edit starts from this version
    setShowImageEditor(false);
    console.log('✅ Image edited and updated');
  };

  const handleEditorCancel = () => {
    setShowImageEditor(false);
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <h2 className="font-title text-xl font-bold text-black mb-4">
        Upload Portrait
      </h2>
      
      {!uploadedImage ? (
        <div
          {...getRootProps()}
          className={`
            flex-1 border-3 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
            ${isDragActive || dragActive 
              ? 'border-[#c6c2e6] bg-[#c6c2e6]/10' 
              : 'border-gray-300 hover:border-[#c6c2e6] hover:bg-[#c6c2e6]/5'
            }
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center h-full">
            <Upload className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-semibold text-black mb-2">
              Drop your portrait here
            </p>
            <p className="text-gray-600 mb-4">
              or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports JPG, PNG, WebP
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1 mb-4">
            <img
              src={uploadedImage}
              alt="Uploaded portrait"
              className="w-full h-full object-cover rounded-lg border-2 border-black"
            />
            <div className="absolute top-2 right-2 flex gap-2">
              <button
                onClick={openEditor}
                className="bg-[#F59E0B] text-black p-1 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                title="Edit image"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={removeImage}
                className="bg-red-500 text-white p-1 rounded-full border-2 border-black shadow-[2px_2px_0px_0px_#000000] hover:shadow-[1px_1px_0px_0px_#000000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="bg-[#c6c2e6]/20 rounded-lg p-3 border-2 border-[#c6c2e6]">
            <div className="flex items-center justify-between text-sm text-black">
              <div className="flex items-center">
                <ImageIcon className="w-4 h-4 mr-2" />
                <span className="font-medium">Portrait uploaded successfully</span>
              </div>
              <button
                onClick={openEditor}
                className="flex items-center gap-1 px-2 py-1 bg-[#F59E0B] text-black rounded border border-black hover:bg-[#D97706] transition-colors text-xs font-medium"
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Editor Modal */}
      {showImageEditor && originalImage && (
        <ImageEditor
          image={originalImage}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </div>
  );
};

export default UploadZone;
