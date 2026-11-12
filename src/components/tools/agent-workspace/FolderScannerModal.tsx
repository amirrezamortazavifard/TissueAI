import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { X, FolderOpen, Image as ImageIcon, Search } from "lucide-react";
import { FolderImage } from "./types";
import { useNotification } from "../../../contexts/NotificationContext";

interface FolderScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage: (imagePath: string) => void;
}

export default function FolderScannerModal({
  isOpen,
  onClose,
  onSelectImage,
}: FolderScannerModalProps) {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [images, setImages] = useState<FolderImage[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const notif = useNotification();

  if (!isOpen) return null;

  const handlePickDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected && typeof selected === "string") {
        setFolderPath(selected);
        setLoading(true);
        try {
          const entries = await invoke<{ name: string; path: string; is_dir: boolean; size: number }[]>(
            "list_directory",
            { path: selected }
          );

          const imgExtensions = [".png", ".jpg", ".jpeg", ".bmp", ".tif", ".tiff", ".svs", ".ndpi", ".webp"];
          const filteredImages: FolderImage[] = entries
            .filter(e => !e.is_dir && imgExtensions.some(ext => e.name.toLowerCase().endsWith(ext)))
            .map(e => ({
              name: e.name,
              path: e.path,
              size: e.size,
            }));

          setImages(filteredImages);
          if (filteredImages.length === 0) {
            notif.info("No supported pathology image files found in selected directory.");
          } else {
            notif.success(`Found ${filteredImages.length} images in folder.`);
          }
        } catch (e) {
          notif.error(`Failed to scan folder: ${e}`);
        } finally {
          setLoading(false);
        }
      }
    } catch (e) {
      notif.error(`Directory selection cancelled or failed: ${e}`);
    }
  };

  const filtered = images.filter(img => img.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="aw-modal-backdrop" onClick={onClose}>
      <div className="aw-modal-card aw-fade-in" onClick={e => e.stopPropagation()}>
        <div className="aw-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)' }}>
              Folder Scanner & WSI Browser
            </span>
          </div>
          <button className="aw-icon-btn" onClick={onClose}><X size={16} /></button>
        </div>

        <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="aw-footer-btn primary"
              onClick={handlePickDirectory}
              style={{ padding: '8px 16px', borderRadius: '10px' }}
            >
              <FolderOpen size={15} /> Select Folder to Scan
            </button>

            {folderPath && (
              <div 
                style={{
                  flex: 1,
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border-2)',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: 'var(--text-2)',
                  display: 'flex',
                  alignItems: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {folderPath}
              </div>
            )}
          </div>

          {images.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-2)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-2)' }}>
              <Search size={14} style={{ color: 'var(--text-3)' }} />
              <input 
                type="text" 
                placeholder="Search images in folder..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '11px', color: 'var(--text-1)', width: '100%' }}
              />
            </div>
          )}

          <div style={{ height: '260px', overflowY: 'auto', border: '1px solid var(--border-2)', borderRadius: '10px', background: 'var(--bg-1)', padding: '8px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', fontSize: '12px' }}>
                Scanning folder entries...
              </div>
            ) : filtered.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {filtered.map((img) => (
                  <div 
                    key={img.path}
                    onClick={() => {
                      onSelectImage(img.path);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-2)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-2)')}
                  >
                    <ImageIcon size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {img.name}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-3)' }}>
                        {(img.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', gap: '8px' }}>
                <FolderOpen size={32} style={{ opacity: 0.3 }} />
                <span style={{ fontSize: '12px' }}>
                  {folderPath ? "No matching images found" : "Click 'Select Folder' above to load a directory of slides"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
