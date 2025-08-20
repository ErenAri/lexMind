"use client";
import { useState, useCallback } from "react";
import { fetchJson } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Shield, X, CheckCircle, AlertCircle, File, FileImage, FileCode, AlertTriangle, Info } from "lucide-react";

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

interface UploadedFile {
  id: string;
  name: string;
  displayName?: string; // Optional custom name
  description?: string; // Optional description
  type: "reg" | "doc";
  content: string;
  status: "uploading" | "awaiting_type" | "ready" | "processing" | "success" | "error";
  progress?: number;
  error?: string;
  file?: File; // Store original file for PDFs
  size?: number; // File size in bytes
  fileType?: string; // File extension
}

export default function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

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
    // Validate file count
    const maxFiles = 10;
    const currentCount = uploadedFiles.filter(f => f.status !== "error").length;
    if (currentCount + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed. You have ${currentCount} files already.`);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = Math.random().toString(36).substr(2, 9);
      
      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
        continue;
      }

      // Validate file type
      const allowedTypes = ['.txt', '.md', '.pdf', '.doc', '.docx', '.json', '.xml', '.csv'];
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!allowedTypes.includes(fileExt)) {
        alert(`File type "${fileExt}" is not supported. Allowed types: ${allowedTypes.join(', ')}`);
        continue;
      }
      
      // Add file to list
      const newFile: UploadedFile = {
        id: fileId,
        name: file.name,
        type: "doc", // Default to doc, user will select
        content: "",
        status: "uploading",
        progress: 0,
        file: file, // Store original file
        size: file.size,
        fileType: fileExt
      };
      
      setUploadedFiles(prev => [...prev, newFile]);

      try {
        // Simulate progress
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += 10;
          if (progress <= 90) {
            setUploadedFiles(prev => prev.map(f =>
              f.id === fileId ? { ...f, progress } : f
            ));
          }
        }, 100);

        // For PDFs, skip text extraction on the client; go straight to type selection
        if (file.type === 'application/pdf') {
          clearInterval(progressInterval);
          setUploadedFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, status: "awaiting_type", progress: 100 } : f
          ));
        } else {
          // Read text file content
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

  const selectFileType = async (fileId: string, type: "reg" | "doc") => {
    const file = uploadedFiles.find(f => f.id === fileId);
    if (!file) return;

    // Only mark as ready; actual upload happens on confirm
    setUploadedFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, type, status: "ready" } : f
    ));
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type === 'application/pdf') {
        // For PDFs, we'll handle them in the upload function
        resolve("PDF_CONTENT"); // Placeholder, will be handled differently
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

  const updateDocumentMeta = async (path: string, fileData: UploadedFile) => {
    if (!fileData.displayName && !fileData.description) return;
    try {
      await fetchJson(`${apiUrl}/documents/${encodeURIComponent(path)}`, {
        method: "PATCH",
        body: JSON.stringify({
          path,
          display_name: fileData.displayName || undefined,
          description: fileData.description || undefined,
        }),
      });
    } catch {}
  };

  const uploadToAPI = async (type: "reg" | "doc", content: string, filename: string, fileData: UploadedFile) => {
    if (filename.toLowerCase().endsWith('.pdf')) {
      // Handle PDF upload
      const uploadedFile = uploadedFiles.find(f => f.name === filename);
      if (!uploadedFile?.file) {
        throw new Error("PDF file not found");
      }
      
      const formData = new FormData();
      formData.append('file', uploadedFile.file);
      formData.append('doc_type', type);
      
      await fetch(`${apiUrl}/ingest/pdf`, {
        method: "POST",
        body: formData
      });
      // Persist optional metadata for this filename
      await updateDocumentMeta(filename, fileData);
    } else {
      // Handle text files as before
      if (type === "reg") {
        // Use custom name if provided, otherwise use filename
        const displayTitle = fileData.displayName || filename;
        const section = displayTitle.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, " ");
        
        await fetchJson(`${apiUrl}/ingest/reg`, {
          method: "POST",
          body: JSON.stringify({
            source: "uploaded",
            title: displayTitle,
            section: section,
            text: content + (fileData.description ? `\n\n[Description: ${fileData.description}]` : "")
          })
        });
      } else {
        // Split content into chunks for documents
        const fullContent = content + (fileData.description ? `\n\n[Description: ${fileData.description}]` : "");
        const chunks = splitIntoChunks(fullContent, 1000);
        const storagePath = filename; // keep raw filename as path; display name stored in metadata
        
        for (let i = 0; i < chunks.length; i++) {
          await fetchJson(`${apiUrl}/ingest/doc`, {
            method: "POST",
            body: JSON.stringify({
              path: storagePath,
              chunk_idx: i,
              content: chunks[i]
            })
          });
        }
        await updateDocumentMeta(storagePath, fileData);
      }
    }
  };

  const splitIntoChunks = (text: string, chunkSize: number): string[] => {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.slice(i, i + chunkSize));
    }
    return chunks;
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
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
      case '.pdf':
        return <FileText size={16} className="text-red-500" />;
      case '.doc':
      case '.docx':
        return <FileText size={16} className="text-blue-500" />;
      case '.json':
      case '.xml':
        return <FileCode size={16} className="text-green-500" />;
      case '.csv':
        return <File size={16} className="text-orange-500" />;
      default:
        return <File size={16} className="text-neutral-400" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "uploading": return <Upload size={16} className="animate-pulse" />;
      case "ready": return <CheckCircle size={16} className="text-blue-500" />;
      case "awaiting_type": return <FileText size={16} className="text-blue-500" />;
      case "processing": return <FileText size={16} className="animate-spin" />;
      case "success": return <CheckCircle size={16} className="text-green-500" />;
      case "error": return <AlertCircle size={16} className="text-red-500" />;
      default: return <FileText size={16} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "uploading": return "Reading file...";
      case "ready": return "Ready to upload";
      case "awaiting_type": return "Select type to upload";
      case "processing": return "Uploading...";
      case "success": return "Uploaded";
      case "error": return "Error";
      default: return "Unknown";
    }
  };

  const allReady = uploadedFiles.length > 0 && uploadedFiles.every(f => f.status === "ready");
  const anyProcessing = uploadedFiles.some(f => f.status === "processing");

  const confirmAllUploads = async () => {
    // Upload all files that are marked as ready
    const readyFiles = uploadedFiles.filter(f => f.status === "ready");
    if (readyFiles.length === 0) return;

    // Set processing for ready files
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

  return (
    <>
      {/* Upload Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
      >
        <Upload size={16} />
        Upload Documents
      </button>

      {/* Upload Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-neutral-900">Upload Documents</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Upload Area */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                  dragActive 
                    ? "border-brand-400 bg-brand-50 scale-[1.02]" 
                    : "border-neutral-300 hover:border-neutral-400 bg-gradient-to-b from-neutral-50 to-white"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {dragActive && (
                  <div className="absolute inset-0 bg-brand-50 bg-opacity-90 rounded-lg flex items-center justify-center z-10">
                    <div className="text-center">
                      <Upload size={64} className="mx-auto mb-2 text-brand-600 animate-bounce" />
                      <p className="text-lg font-semibold text-brand-900">Drop files here</p>
                    </div>
                  </div>
                )}
                
                <div className={dragActive ? "opacity-20" : ""}>
                  <div className="w-20 h-20 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                    <Upload size={32} className="text-neutral-600" />
                  </div>
                  <p className="text-lg font-medium text-neutral-900 mb-2">
                    Upload your documents
                  </p>
                  <p className="text-sm text-neutral-600 mb-6">
                    Drag and drop files here, or click to browse
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <input
                      type="file"
                      multiple
                      accept=".txt,.md,.pdf,.doc,.docx,.json,.xml,.csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-lg hover:bg-brand-700 transition-colors cursor-pointer font-medium"
                    >
                      <FileText size={18} />
                      Choose Files
                    </label>
                  </div>
                  <p className="text-xs text-neutral-500 mt-4">
                    Supported formats: TXT, MD, PDF, DOC, DOCX, JSON, XML, CSV • Max 10MB per file
                  </p>
                </div>
              </div>

              {/* File Types Info */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={20} className="text-blue-500" />
                    <span className="font-medium text-blue-900">Regulations</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Select this for regulatory documents, policies, and compliance requirements
                  </p>
                </div>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={20} className="text-green-500" />
                    <span className="text-xs font-medium text-green-900">Company Documents</span>
                  </div>
                  <p className="text-sm text-green-700">
                    Select this for internal policies, procedures, and company documentation
                  </p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> After uploading files, you'll need to manually select whether each file is a regulation or company document. PDF files are now supported!
                </p>
              </div>

              {/* Upload Statistics */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-neutral-900">
                        {uploadedFiles.length}
                      </div>
                      <div className="text-xs text-neutral-500">Total Files</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">
                        {uploadedFiles.filter(f => f.status === "success").length}
                      </div>
                      <div className="text-xs text-neutral-500">Uploaded</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-brand-600">
                        {uploadedFiles.filter(f => f.status === "ready").length}
                      </div>
                      <div className="text-xs text-neutral-500">Ready</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-neutral-700">Uploaded Files</h3>
                    {uploadedFiles.filter(f => f.status === "ready" || f.status === "error").length > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setUploadedFiles(prev => prev.filter(f => f.status !== "error"))}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Remove errors
                        </button>
                        <button
                          onClick={() => setUploadedFiles([])}
                          className="text-xs text-neutral-600 hover:text-neutral-700"
                        >
                          Clear all
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg"
                      >
                        <div className="space-y-2">
                          {/* File header */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="flex-shrink-0">
                                {getFileIcon(file.fileType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-neutral-900 truncate">
                                    {file.displayName || file.name}
                                  </span>
                                  {file.status === "ready" && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      file.type === "reg" 
                                        ? "bg-blue-100 text-blue-700" 
                                        : "bg-green-100 text-green-700"
                                    }`}>
                                      {file.type === "reg" ? "Regulation" : "Company Document"}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-neutral-500">
                                  <span>{formatFileSize(file.size || 0)}</span>
                                  <span>•</span>
                                  <span>{file.fileType?.toUpperCase().slice(1)} file</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(file.status)}
                              <span className="text-xs text-neutral-600">{getStatusText(file.status)}</span>
                              <button
                                onClick={() => removeFile(file.id)}
                                className="p-1 hover:bg-neutral-200 rounded transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Progress bar for uploading files */}
                          {file.status === "uploading" && file.progress !== undefined && (
                            <div className="relative w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                              <motion.div
                                className="absolute left-0 top-0 h-full bg-brand-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${file.progress}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          )}
                        </div>

                        {/* Type Selection */}
                        {file.status === "awaiting_type" && (
                          <div className="space-y-3">
                            <p className="text-xs text-neutral-600">Select document type:</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => selectFileType(file.id, "reg")}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <Shield size={14} className="text-blue-600" />
                                <span className="text-xs font-medium text-blue-700">Regulation</span>
                              </button>
                              <button
                                onClick={() => selectFileType(file.id, "doc")}
                                className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                              >
                                <FileText size={14} className="text-green-600" />
                                <span className="text-xs font-medium text-green-700">Company Document</span>
                              </button>
                            </div>
                            
                            {/* Optional name and description fields */}
                            <div className="space-y-2 pt-2 border-t border-neutral-100">
                              <p className="text-xs text-neutral-600">Optional details:</p>
                              <input
                                type="text"
                                placeholder="Custom name (optional)"
                                value={file.displayName || ""}
                                onChange={(e) => setUploadedFiles(prev => prev.map(f =>
                                  f.id === file.id ? { ...f, displayName: e.target.value } : f
                                ))}
                                className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                              />
                              <textarea
                                placeholder="Description (optional)"
                                value={file.description || ""}
                                onChange={(e) => setUploadedFiles(prev => prev.map(f =>
                                  f.id === file.id ? { ...f, description: e.target.value } : f
                                ))}
                                rows={2}
                                className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                              />
                            </div>
                          </div>
                        )}

                        {/* Ready indicator with change option */}
                        {file.status === "ready" && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-neutral-700">
                                Type selected: <strong>{file.type === "reg" ? "Regulation" : "Company Document"}</strong>
                              </p>
                              <button
                                onClick={() => setUploadedFiles(prev => prev.map(f =>
                                  f.id === file.id ? { ...f, status: "awaiting_type" } : f
                                ))}
                                className="text-xs text-brand-600 hover:text-brand-700 underline"
                              >
                                Change
                              </button>
                            </div>
                            {(file.displayName || file.description) && (
                              <div className="p-2 bg-neutral-50 rounded text-xs space-y-1">
                                {file.displayName && (
                                  <div><span className="text-neutral-500">Name:</span> <span className="font-medium">{file.displayName}</span></div>
                                )}
                                {file.description && (
                                  <div><span className="text-neutral-500">Description:</span> <span className="text-neutral-700">{file.description}</span></div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Error Display */}
                        {file.status === "error" && file.error && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                            {file.error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Close Button */}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-xs text-neutral-500">
                  {allReady ? "All files are ready to upload" : anyProcessing ? "Uploading..." : "Select type for each file to enable confirmation"}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={confirmAllUploads}
                    disabled={!allReady}
                    className={`px-4 py-2 rounded-lg text-white transition-colors ${allReady ? "bg-brand-600 hover:bg-brand-700" : "bg-neutral-300 cursor-not-allowed"}`}
                  >
                    Confirm All
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-neutral-600 hover:text-neutral-800 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
