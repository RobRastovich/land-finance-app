import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import * as api from '../api/client';
import { Upload, Download, Trash2, FileText, File, Image, FileSpreadsheet, Film } from 'lucide-react';

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return Image;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return FileSpreadsheet;
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return Film;
  if (['pdf', 'doc', 'docx', 'txt', 'rtf'].includes(ext)) return FileText;
  return File;
}

export default function Documents() {
  const { projectId, isAdmin } = useApp();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const docs = await api.getDocuments(projectId);
      setDocuments(docs);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(`Uploading ${file.name} (${i + 1}/${files.length})...`);

        // Get presigned URL
        const { uploadUrl, key } = await api.getUploadUrl(projectId, file.name, file.type);
        console.log('Upload URL received:', key);

        // Upload directly to S3
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          console.error('Upload failed:', uploadRes.status, errorText);
          throw new Error(`Upload failed for ${file.name}: ${uploadRes.status}`);
        }
        console.log('Upload successful:', file.name);

        // Register in database
        setUploadProgress(`Registering ${file.name}...`);
        await api.registerDocument(projectId, key, file.name, file.size, file.type);
        console.log('Document registered:', file.name);
      }
      setUploadProgress('Finalizing...');
      await new Promise(resolve => setTimeout(resolve, 500));
      await load();
      setUploadProgress('');
    } catch (err) {
      console.error('Upload error:', err);
      alert(err.message);
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDownload(doc) {
    try {
      const { downloadUrl } = await api.getDownloadUrl(projectId, doc.key);
      window.open(downloadUrl, '_blank');
    } catch (e) { alert(e.message); }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteDocument(projectId, doc.key);
      load();
    } catch (e) { alert(e.message); }
  }

  if (loading) return <div className="text-gray-400 p-8">Loading documents...</div>;

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Documents</h3>
            <p className="text-sm text-gray-500">{documents.length} file{documents.length !== 1 ? 's' : ''} stored</p>
          </div>
          <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition
            ${uploading ? 'bg-gray-200 text-gray-400' : 'bg-[#1F4E79] text-white hover:bg-[#153452]'}`}>
            <Upload size={16} />
            {uploading ? uploadProgress || 'Uploading...' : 'Upload Files'}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Drop zone hint */}
        {documents.length === 0 && !loading && (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-12 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No documents yet. Upload files to get started.</p>
          </div>
        )}
      </div>

      {/* Documents Table */}
      {documents.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Size</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Last Modified</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {documents.map((doc) => {
                const Icon = getFileIcon(doc.name);
                return (
                  <tr key={doc.key} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Icon size={18} className="text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-800 truncate max-w-xs">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatSize(doc.size)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {doc.lastModified ? new Date(doc.lastModified).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="text-gray-400 hover:text-blue-600 transition p-1"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => handleDelete(doc)}
                            className="text-gray-400 hover:text-red-500 transition p-1"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
