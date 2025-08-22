"use client";
import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { 
  Upload, FileText, Shield, X, CheckCircle, AlertCircle, 
  File, FileImage, FileCode, AlertTriangle, Info, Plus,
  Eye, Edit, Trash2, Clock, User, Calendar, FolderOpen
} from "lucide-react";

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

interface UploadedFile {
  id: string;
  name: string;
  displayName: string;
  description: string;
  type: "reg" | "doc";
  content: string;
  status: "uploading" | "awaiting_type" | "ready" | "processing" | "success" | "error";
  progress?: number;
  error?: string;
  file?: File;
  size?: number;
  fileType?: string;
  tags: string[];
  category?: string;
  author?: string;
}

interface FileMetadata {
  displayName: string;
  description: string;
  tags: string[];
  category: string;
  author: string;
}

export default function EnhancedDocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, '') + '/api/v1';

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    const maxFiles = 20;
    const currentCount = uploadedFiles.filter(f => f.status !== "error").length;
    
    if (currentCount + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed. You have ${currentCount} files already.`);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = Math.random().toString(36).substr(2, 9);
      
      // Validation
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is 25MB.`);
        continue;
      }

      const allowedTypes = ['.txt', '.md', '.pdf', '.doc', '.docx', '.json', '.xml', '.csv', '.rtf', '.odt'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!allowedTypes.includes(fileExt)) {
        alert(`File type "${fileExt}" is not supported. Allowed types: ${allowedTypes.join(', ')}`);
        continue;
      }
      
      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        displayName: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
        description: "",
        type: "doc", // Default
        content: "",
        status: "uploading",
        progress: 0,
        file: file,
        size: file.size,
        fileType: fileExt,
        tags: [],
        category: "",
        author: user?.username || "Unknown"
      };
      
      setUploadedFiles(prev => [...prev, newFile]);

      try {
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += Math.random() * 15 + 5; // Variable progress
          if (progress <= 90) {
            setUploadedFiles(prev => prev.map(f =>
              f.id === fileId ? { ...f, progress: Math.min(progress, 90) } : f
            ));
          }
        }, 200);

        if (file.type === 'application/pdf') {
          clearInterval(progressInterval);
          setUploadedFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, status: "awaiting_type", progress: 100 } : f
          ));
        } else {
          const content = await readFileContent(file);
          clearInterval(progressInterval);
          setUploadedFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, content, status: "awaiting_type", progress: 100 } : f
          ));
        }
      } catch (error: any) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileId ? { ...f, status: "error", error: error?.message || "Unknown error" } : f
        ));
      }
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        resolve("PDF_CONTENT");
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve(content);
        };
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  };

  const updateFileMetadata = (fileId: string, metadata: Partial<FileMetadata>) => {
    setUploadedFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, ...metadata } : f
    ));
  };

  const selectFileType = async (fileId: string, type: "reg" | "doc") => {
    setUploadedFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, type, status: "ready" } : f
    ));
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAllFiles = () => {
    const selectableFiles = uploadedFiles.filter(f => f.status === "awaiting_type" || f.status === "ready");
    if (selectedFiles.size === selectableFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(selectableFiles.map(f => f.id)));
    }
  };

  const bulkSelectType = (type: "reg" | "doc") => {
    setUploadedFiles(prev => prev.map(f =>
      selectedFiles.has(f.id) && (f.status === "awaiting_type" || f.status === "ready") 
        ? { ...f, type, status: "ready" } : f
    ));
  };

  const uploadToAPI = async (type: "reg" | "doc", content: string, filename: string, fileData: UploadedFile) => {
    if (filename.toLowerCase().endsWith('.pdf')) {
      const uploadedFile = uploadedFiles.find(f => f.name === filename);
      if (!uploadedFile?.file) {
        throw new Error("PDF file not found");
      }
      
      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      formData.append('doc_type', type);
      
      const response = await fetch(`${apiUrl}/ingest/pdf`, {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PDF upload failed: ${response.status} ${errorText}`);
      }
    } else {
      if (type === "reg") {
        const displayTitle = fileData.displayName || filename;
        const section = displayTitle.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, " ");
        
        const payload = {
          source: "uploaded",
          title: displayTitle,
          section: section,
          text: content + (fileData.description ? `\n\n[Description: ${fileData.description}]` : "")
            + (fileData.tags.length > 0 ? `\n\n[Tags: ${fileData.tags.join(', ')}]` : "")
            + (fileData.category ? `\n\n[Category: ${fileData.category}]` : "")
            + `\n\n[Author: ${fileData.author}]`
        };

        const response = await fetch(`${apiUrl}/ingest/reg`, {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Regulation upload failed: ${response.status}`);
        }
      } else {
        const fullContent = content + (fileData.description ? `\n\n[Description: ${fileData.description}]` : "")
          + (fileData.tags.length > 0 ? `\n\n[Tags: ${fileData.tags.join(', ')}]` : "")
          + (fileData.category ? `\n\n[Category: ${fileData.category}]` : "")
          + `\n\n[Author: ${fileData.author}]`;
        
        const chunks = splitIntoChunks(fullContent, 1500);
        const storagePath = `${fileData.category || 'general'}/${filename}`;
        
        for (let i = 0; i < chunks.length; i++) {
          const payload = {
            path: storagePath,
            chunk_idx: i,
            content: chunks[i]
          };

          const response = await fetch(`${apiUrl}/ingest/doc`, {
            method: "POST",
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            throw new Error(`Document upload failed: ${response.status}`);
          }
        }
      }
    }
  };

  const splitIntoChunks = (text: string, chunkSize: number): string[] => {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk ? ". " : "") + sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 0);
  };

  const confirmAllUploads = async () => {
    const readyFiles = uploadedFiles.filter(f => f.status === "ready");
    if (readyFiles.length === 0) return;

    setUploadedFiles(prev => prev.map(f =>
      f.status === "ready" ? { ...f, status: "processing" } : f
    ));

    for (const f of readyFiles) {
      try {
        await uploadToAPI(f.type, f.content, f.name, f);
        setUploadedFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "success" } : x));
      } catch (err: any) {
        setUploadedFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: "error", error: err?.message || "Upload failed" } : x));
      }
    }

    onUploadComplete?.();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType?: string) => {
    switch (fileType) {
      case '.pdf': return <FileText size={20} className="text-red-500" />;
      case '.doc':
      case '.docx': return <FileText size={20} className="text-blue-500" />;
      case '.json':
      case '.xml': return <FileCode size={20} className="text-green-500" />;
      case '.csv': return <File size={20} className="text-orange-500" />;
      default: return <File size={20} className="text-gray-400" />;
    }
  };

  const readyFiles = uploadedFiles.filter(f => f.status === "ready");
  const hasReadyFiles = readyFiles.length > 0;
  const processingCount = uploadedFiles.filter(f => f.status === "processing").length;
  const successCount = uploadedFiles.filter(f => f.status === "success").length;
  const errorCount = uploadedFiles.filter(f => f.status === "error").length;

  return (
    <>
      {/* Upload Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl hover:scale-105"
      >
        <Upload size={18} />
        Upload Documents
      </button>

      {/* Enhanced Upload Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-gray-100">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Document Upload Center</h2>
                <p className="text-gray-600 mt-1">Upload and manage compliance documents with rich metadata</p>
              </div>
              <div className="flex items-center gap-4">
                {uploadedFiles.length > 0 && (
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>{successCount} uploaded</span>
                    </div>
                    {processingCount > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span>{processingCount} processing</span>
                      </div>
                    )}
                    {errorCount > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>{errorCount} errors</span>
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
                >
                  <X size={24} className="text-gray-400" />
                </button>
              </div>
            </div>

            <div className="flex h-[calc(90vh-80px)]">
              {/* Left Panel - Upload Area */}
              <div className="flex-1 p-6 border-r border-gray-200">
                
                {/* Upload Area */}
                <div 
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
                    dragActive 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 bg-gradient-to-br from-gray-50/30 to-blue-50/20 hover:border-blue-300 hover:bg-blue-50/30'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="mb-4">
                    <div className="mx-auto w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                      <Upload size={24} className="text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Drop files to upload</h3>
                    <p className="text-gray-500 text-sm">or click to browse</p>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".txt,.md,.pdf,.doc,.docx,.json,.xml,.csv,.rtf,.odt"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium"
                  >
                    <Plus size={16} />
                    Choose Files
                  </button>
                  
                  <div className="mt-4 flex flex-wrap justify-center gap-1 text-xs text-gray-400">
                    {['.pdf', '.doc', '.docx', '.txt', '.md', '.json', '.xml', '.csv', '.rtf', '.odt'].map(ext => (
                      <span key={ext} className="bg-white px-2 py-1 rounded border">{ext.toUpperCase()}</span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Maximum 25MB per file, up to 20 files</p>
                </div>

                {/* Quick Stats */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-6 grid grid-cols-4 gap-3">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <div className="text-lg font-semibold text-blue-600">{uploadedFiles.length}</div>
                      <div className="text-xs text-blue-600">Total Files</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center">
                      <div className="text-lg font-semibold text-green-600">{readyFiles.length}</div>
                      <div className="text-xs text-green-600">Ready</div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg text-center">
                      <div className="text-lg font-semibold text-purple-600">
                        {uploadedFiles.filter(f => f.type === "reg").length}
                      </div>
                      <div className="text-xs text-purple-600">Regulations</div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg text-center">
                      <div className="text-lg font-semibold text-orange-600">
                        {uploadedFiles.filter(f => f.type === "doc").length}
                      </div>
                      <div className="text-xs text-orange-600">Documents</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel - File Management */}
              <div className="w-1/2 flex flex-col">
                
                {/* Bulk Actions */}
                {uploadedFiles.length > 0 && (
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={selectAllFiles}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {selectedFiles.size > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                        {selectedFiles.size > 0 && (
                          <span className="text-sm text-gray-500">
                            {selectedFiles.size} selected
                          </span>
                        )}
                      </div>
                      {selectedFiles.size > 0 && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => bulkSelectType("reg")}
                            className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200"
                          >
                            Mark as Regulations
                          </button>
                          <button
                            onClick={() => bulkSelectType("doc")}
                            className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200"
                          >
                            Mark as Documents
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Files List */}
                <div className="flex-1 overflow-y-auto p-4">
                  {uploadedFiles.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FolderOpen size={48} className="mx-auto mb-3 text-gray-300" />
                      <p>No files uploaded yet</p>
                      <p className="text-sm mt-1">Start by dropping files or clicking "Choose Files"</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {uploadedFiles.map((file) => (
                        <FileItem
                          key={file.id}
                          file={file}
                          isSelected={selectedFiles.has(file.id)}
                          onToggleSelect={() => toggleFileSelection(file.id)}
                          onRemove={() => removeFile(file.id)}
                          onSelectType={(type) => selectFileType(file.id, type)}
                          onUpdateMetadata={(metadata) => updateFileMetadata(file.id, metadata)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                {hasReadyFiles && (
                  <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">Ready to upload</h4>
                        <p className="text-sm text-gray-600">{readyFiles.length} file{readyFiles.length !== 1 ? 's' : ''} configured</p>
                      </div>
                      <CheckCircle size={20} className="text-green-500" />
                    </div>
                    <button
                      onClick={confirmAllUploads}
                      className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <Upload size={18} />
                      Upload {readyFiles.length} File{readyFiles.length !== 1 ? 's' : ''}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// File Item Component
function FileItem({ 
  file, 
  isSelected, 
  onToggleSelect, 
  onRemove, 
  onSelectType, 
  onUpdateMetadata 
}: {
  file: UploadedFile;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRemove: () => void;
  onSelectType: (type: "reg" | "doc") => void;
  onUpdateMetadata: (metadata: Partial<FileMetadata>) => void;
}) {
  const [showMetadata, setShowMetadata] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-700 border-green-200';
      case 'error': return 'bg-red-100 text-red-700 border-red-200';
      case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ready': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'awaiting_type': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType?: string) => {
    switch (fileType) {
      case '.pdf': return <FileText size={16} className="text-red-500" />;
      case '.doc':
      case '.docx': return <FileText size={16} className="text-blue-500" />;
      case '.json':
      case '.xml': return <FileCode size={16} className="text-green-500" />;
      case '.csv': return <File size={16} className="text-orange-500" />;
      default: return <File size={16} className="text-gray-400" />;
    }
  };

  return (
    <div className={`border rounded-xl p-4 transition-all duration-200 ${
      isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
            {getFileIcon(file.fileType)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-900 truncate">{file.name}</div>
            <div className="text-xs text-gray-500 flex items-center gap-2 mt-1">
              <span>{formatFileSize(file.size || 0)}</span>
              <span>•</span>
              <span>{file.fileType?.toUpperCase()}</span>
              {file.author && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <User size={12} />
                    {file.author}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(file.status)}`}>
            {file.status === 'awaiting_type' ? 'Select type' : file.status}
          </span>
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={onRemove}
            className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {file.status === 'uploading' && file.progress !== undefined && (
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Uploading...</span>
            <span>{Math.round(file.progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${file.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Type Selection */}
      {file.status === 'awaiting_type' && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Select document type:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSelectType("reg")}
              className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-sm"
            >
              <Shield size={16} className="text-blue-600" />
              <div className="text-left">
                <div className="font-medium text-blue-700">Regulation</div>
                <div className="text-xs text-blue-600">Compliance rules</div>
              </div>
            </button>
            <button
              onClick={() => onSelectType("doc")}
              className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors text-sm"
            >
              <FileText size={16} className="text-green-600" />
              <div className="text-left">
                <div className="font-medium text-green-700">Document</div>
                <div className="text-xs text-green-600">Company policy</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Metadata Editor */}
      {showMetadata && (
        <div className="mt-3 p-3 border-t border-gray-200 bg-gray-50 rounded-b-lg space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Display Name</label>
            <input
              type="text"
              value={file.displayName}
              onChange={(e) => onUpdateMetadata({ displayName: e.target.value })}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter display name"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={file.description}
              onChange={(e) => onUpdateMetadata({ description: e.target.value })}
              rows={2}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of the document"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select
                value={file.category}
                onChange={(e) => onUpdateMetadata({ category: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select category</option>
                <option value="policy">Policy</option>
                <option value="procedure">Procedure</option>
                <option value="regulation">Regulation</option>
                <option value="guideline">Guideline</option>
                <option value="manual">Manual</option>
                <option value="standard">Standard</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tags</label>
              <input
                type="text"
                value={file.tags.join(', ')}
                onChange={(e) => onUpdateMetadata({ tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="tag1, tag2, tag3"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {file.error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
          <AlertCircle size={12} className="inline mr-1" />
          {file.error}
        </div>
      )}
    </div>
  );
}