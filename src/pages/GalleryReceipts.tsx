import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { GalleryItem, Party } from '../types';
import { db, storage } from '../lib/firebase';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { 
  Plus, Search, Filter, Calendar, FileText, Image as ImageIcon, Download, 
  Trash2, ZoomIn, ZoomOut, RotateCcw, X, UploadCloud, Camera as CameraIcon, 
  Eye, CheckCircle2, AlertCircle, Tag, DollarSign, User, ExternalLink, RefreshCw
} from 'lucide-react';
import NepaliDate from 'nepali-datetime';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export default function GalleryReceipts() {
  const { language, farmId } = useAppStore();
  const t = translations[language];

  // State
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [filterDateBS, setFilterDateBS] = useState('');

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<GalleryItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<GalleryItem | null>(null);

  // Upload Form State
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('Feed Purchase');
  const [vendorName, setVendorName] = useState('');
  const [dateBS, setDateBS] = useState(new NepaliDate().format('YYYY MMMM DD'));
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Upload progress & states
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Lightbox Zoom & Rotation State
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Category definitions
  const CATEGORIES = [
    { id: 'Feed Purchase', label: t.feedPurchase || 'Feed Purchase' },
    { id: 'Medicine Bill', label: t.medicineBill || 'Medicine Bill' },
    { id: 'Equipment Receipt', label: t.equipmentReceipt || 'Equipment Receipt' },
    { id: 'Lease Paper', label: t.leasePaper || 'Lease Paper' },
    { id: 'Seeds & Fertilizers', label: t.seedFertilizerBill || 'Seeds & Fertilizers' },
    { id: 'Utility Bill', label: t.utilityBill || 'Utility Bill' },
    { id: 'General Receipt', label: t.generalReceipt || 'General Receipt' },
  ];

  // Fetch Gallery Items from Firestore
  useEffect(() => {
    if (!farmId) return;
    setLoading(true);
    const q = query(collection(db, 'gallery'), where('farmId', '==', farmId));
    const unsub = onSnapshot(q, snap => {
      const docsList: GalleryItem[] = [];
      snap.forEach(docSnap => {
        docsList.push({ id: docSnap.id, ...docSnap.data() } as GalleryItem);
      });
      // Sort newest first
      docsList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(docsList);
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to gallery items:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [farmId]);

  // Fetch Parties for auto-suggestion
  useEffect(() => {
    if (!farmId) return;
    const fetchParties = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'parties'), where('farmId', '==', farmId)));
        const pts: Party[] = [];
        snap.forEach(d => pts.push({ id: d.id, ...d.data() } as Party));
        setParties(pts);
      } catch (err) {
        console.error("Error loading parties:", err);
      }
    };
    fetchParties();
  }, [farmId]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setErrorMessage(null);

    // Auto set title if empty
    if (!docTitle) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setDocTitle(nameWithoutExt.replace(/[-_]/g, ' '));
    }

    // Generate local preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      setFilePreview('PDF_PREVIEW');
    } else {
      setFilePreview(null);
    }
  };

  // Capacitor Camera Capture Integration
  const handleCameraCapture = async () => {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      });

      if (photo && photo.dataUrl) {
        // Convert DataUrl to File
        const fileName = `receipt_${Date.now()}.${photo.format || 'jpg'}`;
        const res = await fetch(photo.dataUrl);
        const blob = await res.blob();
        const file = new File([blob], fileName, { type: `image/${photo.format || 'jpeg'}` });
        processFile(file);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('User cancelled')) {
        console.warn('Camera error:', err);
      }
    }
  };

  // Upload File to Firebase Storage with Fallback
  const uploadToStorage = async (file: File): Promise<{ url: string; storagePath?: string }> => {
    return new Promise(async (resolve) => {
      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `gallery_receipts/${farmId}/${Date.now()}_${cleanName}`;
        const storageRef = ref(storage, path);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          (snap) => {
            const p = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUploadProgress(p);
          },
          (err) => {
            console.warn("Storage upload failed, using local DataURL fallback:", err);
            // Fallback to Base64 Data URL
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({ url: reader.result as string });
            };
            reader.readAsDataURL(file);
          },
          async () => {
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve({ url: downloadUrl, storagePath: path });
            } catch (err) {
              const reader = new FileReader();
              reader.onloadend = () => resolve({ url: reader.result as string });
              reader.readAsDataURL(file);
            }
          }
        );
      } catch (err) {
        console.warn("Direct storage fallback triggered:", err);
        const reader = new FileReader();
        reader.onloadend = () => resolve({ url: reader.result as string });
        reader.readAsDataURL(file);
      }
    });
  };

  // Submit Upload Form
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;

    if (!selectedFile) {
      setErrorMessage(language === 'ne' ? 'कृपया फाइल चयन गर्नुहोस् वा फोटो खिच्नुहोस्।' : 'Please select a file or take a photo.');
      return;
    }

    if (!docTitle.trim()) {
      setErrorMessage(language === 'ne' ? 'कृपया कागजातको शीर्षक लेख्नुहोस्।' : 'Please enter document title.');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(10);
    setErrorMessage(null);

    try {
      const { url, storagePath } = await uploadToStorage(selectedFile);
      setUploadProgress(90);

      const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
      const fileType = isPdf ? 'pdf' : 'image';

      // Save metadata in Firestore 'gallery' collection
      await addDoc(collection(db, 'gallery'), {
        farmId,
        title: docTitle.trim(),
        category: docCategory,
        vendorName: vendorName.trim(),
        dateBS: dateBS,
        amount: amount ? parseFloat(amount) : 0,
        notes: notes.trim(),
        fileUrl: url,
        fileName: selectedFile.name,
        fileType,
        fileSize: selectedFile.size,
        storagePath: storagePath || null,
        createdAt: Date.now()
      });

      setUploadProgress(100);
      setIsSubmitting(false);
      resetUploadModal();
    } catch (err: any) {
      console.error("Error uploading document:", err);
      setErrorMessage(err.message || t.uploadError);
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const resetUploadModal = () => {
    setIsUploadOpen(false);
    setDocTitle('');
    setDocCategory('Feed Purchase');
    setVendorName('');
    setDateBS(new NepaliDate().format('YYYY MMMM DD'));
    setAmount('');
    setNotes('');
    setSelectedFile(null);
    setFilePreview(null);
    setUploadProgress(null);
    setErrorMessage(null);
  };

  // Delete Document
  const handleDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      // 1. Delete from Firebase Storage if storagePath exists
      if (deleteConfirmItem.storagePath) {
        try {
          const fileRef = ref(storage, deleteConfirmItem.storagePath);
          await deleteObject(fileRef);
        } catch (storageErr) {
          console.warn("Storage deletion warning:", storageErr);
        }
      }
      // 2. Delete from Firestore
      await deleteDoc(doc(db, 'gallery', deleteConfirmItem.id));
      setDeleteConfirmItem(null);
      if (previewItem?.id === deleteConfirmItem.id) {
        setPreviewItem(null);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  // Download File Helper
  const downloadFile = (item: GalleryItem) => {
    const link = document.createElement('a');
    link.href = item.fileUrl;
    link.download = item.fileName || `${item.title}.${item.fileType === 'pdf' ? 'pdf' : 'jpg'}`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering Logic
  const filteredItems = items.filter(item => {
    // Search query match
    const matchesSearch = 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.vendorName && item.vendorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    // Category match
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;

    // Date match
    const matchesDate = !filterDateBS || (item.dateBS && item.dateBS.includes(filterDateBS));

    return matchesSearch && matchesCategory && matchesDate;
  });

  // Aggregated Stats
  const totalCount = items.length;
  const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Feed Purchase':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Medicine Bill':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Equipment Receipt':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Lease Paper':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Seeds & Fertilizers':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Utility Bill':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-stone-100 text-stone-800 border-stone-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center space-x-2.5">
            <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <FileText size={22} />
            </span>
            <span>{t.galleryAndReceipts}</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            {t.gallerySub}
          </p>
        </div>

        {/* Quick Stats & Upload Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-1.5 bg-white border border-stone-200 rounded-xl shadow-xs text-xs">
            <span className="text-stone-500">{t.totalReceipts}:</span>{' '}
            <strong className="text-stone-800 font-bold">{totalCount}</strong>
          </div>
          {totalAmount > 0 && (
            <div className="px-3.5 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl shadow-xs text-xs font-semibold">
              <span className="text-emerald-600 font-normal">{t.totalReceiptAmount}:</span>{' '}
              रु. {totalAmount.toLocaleString()}
            </div>
          )}
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm font-semibold text-sm transition-colors"
          >
            <Plus size={18} />
            <span>{t.uploadBillReceipt}</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-5 relative">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder={t.searchReceipts}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="lg:col-span-4 relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="ALL">📁 {t.allCategories}</option>
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters / Clear */}
          <div className="lg:col-span-3 flex items-center gap-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
                setFilterDateBS('');
              }}
              className="px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors border border-stone-200 w-full flex items-center justify-center space-x-1.5"
            >
              <RotateCcw size={14} />
              <span>{language === 'ne' ? 'सबै फिल्टर हटाउनुहोस्' : 'Reset Filters'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Gallery Visual Grid */}
      {loading ? (
        <div className="p-16 text-center">
          <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-stone-500">{language === 'ne' ? 'कागजातहरू लोड हुँदैछन्...' : 'Loading documents...'}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-12 text-center">
          <div className="w-16 h-16 bg-stone-100 text-stone-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ImageIcon size={32} />
          </div>
          <h3 className="text-base font-bold text-stone-700 mb-1">{t.noReceiptsFound}</h3>
          <p className="text-xs text-stone-400 max-w-md mx-auto mb-5">
            {language === 'ne' 
              ? 'तपाईंले खरिद गरेका दाना, औषधि, उपकरण तथा जग्गाका कागजात र बिलहरू यहाँ सुरक्षित राख्न सक्नुहुन्छ।' 
              : 'Keep all receipts, bills, purchase vouchers, and land lease papers organized and accessible.'}
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus size={16} />
            <span>{t.uploadBillReceipt}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredItems.map(item => {
            const isPdf = item.fileType === 'pdf';

            return (
              <div
                key={item.id}
                className="group bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                {/* Visual Thumbnail Area */}
                <div 
                  onClick={() => setPreviewItem(item)}
                  className="relative aspect-4/3 bg-stone-100 cursor-pointer overflow-hidden flex items-center justify-center"
                >
                  {isPdf ? (
                    <div className="flex flex-col items-center justify-center p-6 text-stone-500 group-hover:scale-105 transition-transform duration-200">
                      <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-2 shadow-xs">
                        <FileText size={28} />
                      </div>
                      <span className="text-xs font-bold text-stone-600 truncate max-w-[150px]">
                        {item.fileName}
                      </span>
                      <span className="text-[10px] text-rose-600 font-bold uppercase mt-0.5">PDF Document</span>
                    </div>
                  ) : (
                    <img
                      src={item.fileUrl}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}

                  {/* Top Badges (Category & Amount) */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 pointer-events-none">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-xs ${getCategoryColor(item.category)}`}>
                      {item.category}
                    </span>
                    {item.amount && item.amount > 0 ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-stone-900/80 text-white backdrop-blur-xs shadow-xs">
                        रु. {item.amount.toLocaleString()}
                      </span>
                    ) : null}
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl bg-white/90 text-stone-800 font-semibold text-xs flex items-center space-x-1 shadow-md">
                      <Eye size={14} />
                      <span>{t.preview}</span>
                    </span>
                  </div>
                </div>

                {/* Metadata Card Footer */}
                <div className="p-3.5 space-y-2">
                  <div>
                    <h3 
                      onClick={() => setPreviewItem(item)}
                      className="font-bold text-stone-800 text-sm truncate hover:text-emerald-600 cursor-pointer" 
                      title={item.title}
                    >
                      {item.title}
                    </h3>
                    {item.vendorName && (
                      <p className="text-xs text-stone-500 flex items-center space-x-1 mt-0.5 truncate">
                        <User size={11} className="text-stone-400 shrink-0" />
                        <span className="truncate">{item.vendorName}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[11px] text-stone-500">
                    <span className="flex items-center space-x-1">
                      <Calendar size={12} className="text-stone-400" />
                      <span>{item.dateBS}</span>
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(item);
                        }}
                        className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                        title={t.download}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmItem(item);
                        }}
                        className="p-1 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title={t.delete}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* UPLOAD BILL / RECEIPT MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-stone-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-stone-800">{t.uploadBillReceipt}</h2>
                  <p className="text-xs text-stone-500">
                    {language === 'ne' ? 'कागजात, बिल वा रसिद सुरक्षित भण्डारण गर्नुहोस्' : 'Attach farm bills, vouchers and contracts to database'}
                  </p>
                </div>
              </div>
              <button
                onClick={resetUploadModal}
                disabled={isSubmitting}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-xs">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Upload Form */}
            <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
              {/* File Dropzone & Camera Option */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  {t.fileUploadDropzone} <span className="text-red-500">*</span>
                </label>

                {!selectedFile ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                      isDragOver ? 'border-emerald-500 bg-emerald-50/40' : 'border-stone-200 hover:border-emerald-400 bg-stone-50/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                      <UploadCloud size={24} />
                    </div>
                    <p className="text-sm font-semibold text-stone-700 mb-1">{t.dragDropFile}</p>
                    <p className="text-xs text-stone-400 mb-4">PNG, JPG, WEBP, or PDF (Max 15MB)</p>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
                      >
                        <UploadCloud size={14} />
                        <span>{t.chooseFromDevice}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCameraCapture}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5"
                      >
                        <CameraIcon size={14} />
                        <span>{t.captureWithCamera}</span>
                      </button>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      {filePreview === 'PDF_PREVIEW' ? (
                        <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                          <FileText size={22} />
                        </div>
                      ) : filePreview ? (
                        <img
                          src={filePreview}
                          alt="Selected Preview"
                          className="w-12 h-12 rounded-xl object-cover border border-emerald-200 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center shrink-0">
                          <FileText size={22} />
                        </div>
                      )}

                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-stone-800 truncate">{selectedFile.name}</p>
                        <p className="text-[11px] text-stone-500">{formatFileSize(selectedFile.size)}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Document Title */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  {t.documentTitle} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder={language === 'ne' ? 'कागजातको नाम / बिल शीर्षक...' : 'e.g. Broiler Feed Batch #4 Purchase'}
                  required
                  className="w-full px-4 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                />
              </div>

              {/* Category & Associated Party */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {t.relatedCategory} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {t.vendorPartyName}
                  </label>
                  <input
                    type="text"
                    list="parties-list"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder={language === 'ne' ? 'पार्टी वा सप्लायरको नाम...' : 'Supplier or vendor name...'}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <datalist id="parties-list">
                    {parties.map(p => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* B.S. Date & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {t.dateBS}
                  </label>
                  <NepaliDatePicker
                    value={dateBS}
                    onChange={(val) => setDateBS(val)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    {t.documentAmount}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">रु.</span>
                    <input
                      type="number"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  {t.remarksNotes}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={language === 'ne' ? 'थप कैफियत वा टिप्पणी...' : 'Optional notes or receipt ID...'}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Progress Indicator */}
              {uploadProgress !== null && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs text-stone-500 font-semibold">
                    <span>{t.uploadProgress}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={resetUploadModal}
                  disabled={isSubmitting}
                  className="px-5 py-2 text-stone-600 font-semibold hover:bg-stone-100 rounded-xl text-sm transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedFile}
                  className="flex items-center space-x-2 px-6 py-2 bg-emerald-600 text-white font-semibold hover:bg-emerald-700 active:scale-98 rounded-xl shadow-md shadow-emerald-600/20 text-sm transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>{t.saving || 'Uploading...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>{t.saveEntry || t.save}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN PREVIEW LIGHTBOX MODAL */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-md flex flex-col p-4">
          {/* Lightbox Header Bar */}
          <div className="flex items-center justify-between text-white pb-3 border-b border-stone-800 shrink-0">
            <div className="flex items-center space-x-3">
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${getCategoryColor(previewItem.category)}`}>
                {previewItem.category}
              </span>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">{previewItem.title}</h2>
                <div className="flex items-center space-x-3 text-xs text-stone-400 mt-0.5">
                  <span>{previewItem.dateBS}</span>
                  {previewItem.vendorName && <span>• {previewItem.vendorName}</span>}
                  {previewItem.amount ? <span>• रु. {previewItem.amount.toLocaleString()}</span> : null}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-2">
              {/* Zoom In/Out for images */}
              {previewItem.fileType !== 'pdf' && (
                <>
                  <button
                    onClick={() => setZoomLevel(prev => Math.min(prev + 0.25, 3))}
                    className="p-2 rounded-xl bg-stone-800 text-stone-200 hover:text-white hover:bg-stone-700 transition-colors"
                    title={t.zoomIn}
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    onClick={() => setZoomLevel(prev => Math.max(prev - 0.25, 0.5))}
                    className="p-2 rounded-xl bg-stone-800 text-stone-200 hover:text-white hover:bg-stone-700 transition-colors"
                    title={t.zoomOut}
                  >
                    <ZoomOut size={18} />
                  </button>
                  <button
                    onClick={() => { setZoomLevel(1); setRotation(0); }}
                    className="p-2 rounded-xl bg-stone-800 text-stone-200 hover:text-white hover:bg-stone-700 transition-colors"
                    title={t.resetZoom}
                  >
                    <RotateCcw size={18} />
                  </button>
                </>
              )}

              {/* Download */}
              <button
                onClick={() => downloadFile(previewItem)}
                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                title={t.download}
              >
                <Download size={18} />
              </button>

              {/* Delete */}
              <button
                onClick={() => setDeleteConfirmItem(previewItem)}
                className="p-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white transition-colors"
                title={t.delete}
              >
                <Trash2 size={18} />
              </button>

              {/* Close */}
              <button
                onClick={() => {
                  setPreviewItem(null);
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className="p-2 rounded-xl bg-stone-800 text-stone-200 hover:text-white hover:bg-stone-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Lightbox Content Viewer */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {previewItem.fileType === 'pdf' ? (
              <div className="w-full max-w-4xl h-full bg-white rounded-2xl overflow-hidden flex flex-col shadow-2xl">
                <div className="flex-1 bg-stone-100 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
                    <FileText size={42} />
                  </div>
                  <h3 className="text-lg font-bold text-stone-800 mb-1">{previewItem.fileName}</h3>
                  <p className="text-xs text-stone-500 mb-6">
                    {formatFileSize(previewItem.fileSize)} • {previewItem.category}
                  </p>
                  <div className="flex items-center space-x-3">
                    <a
                      href={previewItem.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm shadow-md transition-colors flex items-center space-x-2"
                    >
                      <ExternalLink size={16} />
                      <span>{t.openFullFile}</span>
                    </a>
                    <button
                      onClick={() => downloadFile(previewItem)}
                      className="px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-semibold text-sm shadow-md transition-colors flex items-center space-x-2"
                    >
                      <Download size={16} />
                      <span>{t.download}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden">
                <img
                  src={previewItem.fileUrl}
                  alt={previewItem.title}
                  style={{
                    transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="max-h-[80vh] max-w-[90vw] object-contain rounded-xl shadow-2xl select-none"
                />
              </div>
            )}
          </div>

          {/* Lightbox Footer Details */}
          {previewItem.notes && (
            <div className="shrink-0 max-w-xl mx-auto bg-stone-900/80 text-stone-300 text-xs px-4 py-2 rounded-xl border border-stone-800 backdrop-blur-sm text-center">
              <span className="font-semibold text-stone-400">{t.remarksNotes}:</span> {previewItem.notes}
            </div>
          )}
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-60 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center border border-stone-100">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 size={24} />
            </div>
            <h3 className="text-base font-bold text-stone-800 mb-1">{t.deleteDoc}</h3>
            <p className="text-xs text-stone-500 mb-5">{t.deleteDocConfirm}</p>

            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 text-xs transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-sm transition-colors"
              >
                {t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
