import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  blockNonNumericKey,
  formatAadhaar,
  formatDate,
  formatINR,
  sanitizeNumber,
} from '../utils/format';
import { IconClose, IconEdit, IconFile, IconPlus, IconSearch, IconTrash, IconUpload } from '../components/Icons';

const DOC_TYPES = [
  'Aadhaar Card',
  'PAN Card',
  'Bank Passbook',
  'Passport Photo',
  'Ration / Smart Card',
  'Income Certificate',
  'Community Certificate',
  'Nativity Certificate',
  'Voter ID',
  'Marksheet / TC',
  'Application Receipt',
  'Other Document',
];

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number (Digits Only)' },
  { value: 'phone', label: 'Mobile / Phone' },
  { value: 'date', label: 'Date' },
  { value: 'email', label: 'Email' },
  { value: 'textarea', label: 'Long Text / Notes' },
  { value: 'select', label: 'Dropdown Options' },
  { value: 'yesno', label: 'Yes / No' },
];

const EMPTY_CLIENT = {
  name: '',
  phone: '',
  email: '',
  address: '',
  aadhaar_number: '',
  pan_number: '',
  bank_account: '',
  ration_card: '',
  dob: '',
  notes: '',
  extra_details: {},
  custom_items: [], // [{ title, data_type, value }]
};

function isImageDoc(doc) {
  if (!doc) return false;
  return doc.resource_type === 'image' && String(doc.file_format || '').toLowerCase() !== 'pdf';
}

export default function ClientsPage() {
  const { user, hasPerm } = useAuth();
  const { showToast } = useToast();

  const [clients, setClients] = useState([]);
  const [defaultFields, setDefaultFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mobileSearch, setMobileSearch] = useState('');

  // Universal Customer Detail Settings modal
  const [settingsModal, setSettingsModal] = useState(false);
  const [newField, setNewField] = useState({ title: '', data_type: 'text', options: '', is_required: false });

  // Add/Edit Customer modal (with inline Aadhaar / PAN / Bank Passbook Cloudinary upload & preview!)
  const [clientModal, setClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [form, setForm] = useState(EMPTY_CLIENT);
  const [existingSlotDocs, setExistingSlotDocs] = useState({ aadhaar: null, pan: null, bank: null });
  const [pendingFiles, setPendingFiles] = useState({ aadhaar: null, pan: null, bank: null });
  const [pendingPreviews, setPendingPreviews] = useState({ aadhaar: '', pan: '', bank: '' });
  const [saving, setSaving] = useState(false);

  // Customer Card Detail & Selectable Cloudinary Assets Modal
  const [vaultModal, setVaultModal] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState([]);
  const [docType, setDocType] = useState('Aadhaar Card');
  const [docTitle, setDocTitle] = useState('');
  const [docFile, setDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const loadDefaultFields = useCallback(async () => {
    try {
      const res = await api.getClientFields();
      setDefaultFields(res.fields || []);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }, [showToast]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getClients({
        store_id: 'all',
        search: mobileSearch,
      });
      setClients(res.clients || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [mobileSearch, showToast]);

  useEffect(() => {
    loadDefaultFields();
  }, [loadDefaultFields]);

  useEffect(() => {
    const t = setTimeout(loadClients, 160);
    return () => clearTimeout(t);
  }, [loadClients]);

  // Filter out bank_account from Universal box since Bank Account Details is now a primary card
  const universalFields = defaultFields.filter((f) => f.field_key !== 'bank_account');

  const clearPendingPreviews = () => {
    Object.values(pendingPreviews).forEach((url) => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });
    setPendingFiles({ aadhaar: null, pan: null, bank: null });
    setPendingPreviews({ aadhaar: '', pan: '', bank: '' });
  };

  const handleSelectSlotFile = (slot, file) => {
    if (pendingPreviews[slot] && pendingPreviews[slot].startsWith('blob:')) {
      URL.revokeObjectURL(pendingPreviews[slot]);
    }
    if (!file) {
      setPendingFiles((p) => ({ ...p, [slot]: null }));
      setPendingPreviews((p) => ({ ...p, [slot]: '' }));
      return;
    }
    const previewUrl = file.type && file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setPendingFiles((p) => ({ ...p, [slot]: file }));
    setPendingPreviews((p) => ({ ...p, [slot]: previewUrl }));
  };

  // ===== UNIVERSAL CUSTOMER DETAIL SETTINGS HANDLERS =====
  const handleAddDefaultField = async (e) => {
    e.preventDefault();
    if (!newField.title.trim()) return;
    try {
      await api.createClientField(newField);
      showToast(`Added "${newField.title}" to Universal Customer Details`, 'success');
      setNewField({ title: '', data_type: 'text', options: '', is_required: false });
      await loadDefaultFields();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRenameDefaultField = async (field, nextTitle) => {
    if (!nextTitle.trim() || nextTitle.trim() === field.title) return;
    try {
      await api.updateClientField(field.id, { title: nextTitle.trim() });
      await loadDefaultFields();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateDefaultField = async (field, patch) => {
    try {
      await api.updateClientField(field.id, patch);
      await loadDefaultFields();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteDefaultField = async (field) => {
    if (!window.confirm(`Remove universal customer field "${field.title}"?`)) return;
    try {
      const res = await api.deleteClientField(field.id);
      showToast(res.message || 'Field removed', 'success');
      await loadDefaultFields();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ===== ADD / EDIT CUSTOMER HANDLERS =====
  const openCreate = () => {
    clearPendingPreviews();
    setExistingSlotDocs({ aadhaar: null, pan: null, bank: null });
    setEditingClient(null);
    setForm(EMPTY_CLIENT);
    setClientModal(true);
  };

  const openEdit = async (c, e) => {
    if (e) e.stopPropagation();
    clearPendingPreviews();
    const extra = c.extra_details && typeof c.extra_details === 'object' ? { ...c.extra_details } : {};
    const customItems = Array.isArray(extra._custom_items) ? extra._custom_items : [];
    const bankAccount = extra.bank_account || '';
    delete extra._custom_items;

    setEditingClient(c);
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      aadhaar_number: c.aadhaar_number || '',
      pan_number: c.pan_number || '',
      bank_account: bankAccount,
      ration_card: c.ration_card || '',
      dob: c.dob || '',
      notes: c.notes || '',
      extra_details: extra,
      custom_items: customItems,
    });
    setExistingSlotDocs({ aadhaar: null, pan: null, bank: null });
    setClientModal(true);

    // Fetch existing Cloudinary documents so Aadhaar / PAN / Bank Passbook previews show right in the form!
    try {
      const res = await api.getClient(c.id);
      const docs = res.documents || [];
      setExistingSlotDocs({
        aadhaar: docs.find((d) => String(d.doc_type || '').toLowerCase().includes('aadhaar')) || null,
        pan: docs.find((d) => String(d.doc_type || '').toLowerCase().includes('pan')) || null,
        bank: docs.find((d) => {
          const t = String(d.doc_type || '').toLowerCase();
          return t.includes('bank') || t.includes('passbook');
        }) || null,
      });
    } catch {
      // ignore
    }
  };

  const addPerClientCustomItem = () => {
    setForm((p) => ({
      ...p,
      custom_items: [...p.custom_items, { title: '', data_type: 'text', value: '' }],
    }));
  };

  const updatePerClientCustomItem = (idx, patch) => {
    setForm((p) => ({
      ...p,
      custom_items: p.custom_items.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    }));
  };

  const removePerClientCustomItem = (idx) => {
    setForm((p) => ({
      ...p,
      custom_items: p.custom_items.filter((_, i) => i !== idx),
    }));
  };

  const saveClient = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanCustomItems = (form.custom_items || []).filter((it) => it.title && it.title.trim());
      const payload = {
        store_id: editingClient ? editingClient.store_id : (user?.store_id || null),
        name: form.name,
        phone: form.phone,
        email: form.email,
        address: form.address,
        aadhaar_number: form.aadhaar_number,
        aadhaar_words: '',
        pan_number: form.pan_number,
        ration_card: form.ration_card,
        dob: form.dob,
        notes: form.notes,
        extra_details: {
          ...(form.extra_details || {}),
          bank_account: form.bank_account || '',
          _custom_items: cleanCustomItems,
        },
      };

      let savedClientId;
      if (editingClient) {
        await api.updateClient(editingClient.id, payload);
        savedClientId = editingClient.id;
      } else {
        const created = await api.createClient(payload);
        savedClientId = created.client.id;
      }

      // Upload / Replace Aadhaar, PAN, or Bank Passbook files directly to Cloudinary!
      const slotMeta = [
        { key: 'aadhaar', docType: 'Aadhaar Card', title: 'Aadhaar Document' },
        { key: 'pan', docType: 'PAN Card', title: 'PAN Card' },
        { key: 'bank', docType: 'Bank Passbook', title: 'Bank Account / Passbook' },
      ];

      let uploadedCount = 0;
      for (const slot of slotMeta) {
        const file = pendingFiles[slot.key];
        if (!file) continue;
        // Replace old slot doc if updating
        if (existingSlotDocs[slot.key]) {
          try {
            await api.deleteClientDoc(savedClientId, existingSlotDocs[slot.key].id);
          } catch {
            // proceed with upload
          }
        }
        const fd = new FormData();
        fd.append('file', file);
        fd.append('doc_type', slot.docType);
        fd.append('title', file.name || slot.title);
        await api.uploadClientDoc(savedClientId, fd);
        uploadedCount++;
      }

      showToast(
        uploadedCount > 0
          ? `Customer saved & ${uploadedCount} document(s) uploaded to Cloudinary!`
          : editingClient
            ? 'Customer updated (synced with Live Sheet)'
            : 'Customer saved!',
        'success'
      );

      clearPendingPreviews();
      setClientModal(false);

      if (vaultModal?.client?.id === savedClientId) {
        const refreshed = await api.getClient(savedClientId);
        setVaultModal(refreshed);
      }
      loadClients();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteClient = async (c, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete customer "${c.name}" and all their uploaded assets?`)) return;
    try {
      await api.deleteClient(c.id);
      showToast('Customer deleted', 'success');
      loadClients();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // ===== CUSTOMER VAULT & ASSETS HANDLERS =====
  const openVault = async (clientId) => {
    setLoadingVault(true);
    setSelectedAssetIds([]);
    setVaultModal({ client: null, documents: [], transactions: [] });
    try {
      const res = await api.getClient(clientId);
      setVaultModal(res);
    } catch (err) {
      showToast(err.message, 'error');
      setVaultModal(null);
    } finally {
      setLoadingVault(false);
    }
  };

  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!docFile || !vaultModal?.client) return;
    setUploadingDoc(true);
    try {
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('doc_type', docType);
      fd.append('title', docTitle.trim() || docType);
      await api.uploadClientDoc(vaultModal.client.id, fd);
      showToast('Asset uploaded to Cloudinary!', 'success');
      setDocFile(null);
      setDocTitle('');
      const refreshed = await api.getClient(vaultModal.client.id);
      setVaultModal(refreshed);
      loadClients();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (doc, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete asset "${doc.title}"?`)) return;
    try {
      await api.deleteClientDoc(vaultModal.client.id, doc.id);
      showToast('Asset deleted', 'success');
      setSelectedAssetIds((prev) => prev.filter((x) => x !== doc.id));
      const refreshed = await api.getClient(vaultModal.client.id);
      setVaultModal(refreshed);
      loadClients();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleAssetSelect = (docId) => {
    setSelectedAssetIds((prev) => (prev.includes(docId) ? prev.filter((x) => x !== docId) : [...prev, docId]));
  };

  const chosenDocs = (vaultModal?.documents || []).filter((d) => selectedAssetIds.includes(d.id));

  const openChosenAssets = () => {
    chosenDocs.forEach((d) => window.open(d.cloudinary_url, '_blank', 'noopener,noreferrer'));
  };

  const copyChosenLinks = async () => {
    const text = chosenDocs.map((d) => `${d.doc_type} - ${d.title}: ${d.cloudinary_url}`).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied ${chosenDocs.length} asset link(s)!`, 'success');
    } catch {
      showToast('Could not copy links automatically', 'error');
    }
  };

  const renderDynamicInput = (field, value, onChange) => {
    const dt = field.data_type || 'text';
    if (dt === 'textarea') {
      return (
        <textarea
          className="textarea"
          style={{ minHeight: 54 }}
          required={Boolean(field.is_required)}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }
    if (dt === 'select') {
      return (
        <select
          className="select"
          required={Boolean(field.is_required)}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">-- Select --</option>
          {(field.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (dt === 'yesno') {
      return (
        <select
          className="select"
          required={Boolean(field.is_required)}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">-- Select --</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    }
    if (dt === 'number' || dt === 'phone') {
      const allowDec = dt === 'number';
      return (
        <input
          type="text"
          inputMode={allowDec ? 'decimal' : 'numeric'}
          className="input"
          required={Boolean(field.is_required)}
          value={value || ''}
          onKeyDown={(e) => blockNonNumericKey(e, allowDec)}
          onChange={(e) => onChange(sanitizeNumber(e.target.value, allowDec))}
        />
      );
    }
    return (
      <input
        type={dt === 'date' ? 'date' : dt === 'email' ? 'email' : 'text'}
        className="input"
        required={Boolean(field.is_required)}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  };

  const renderSlotPreview = (slotKey, label) => {
    const pendingFile = pendingFiles[slotKey];
    const pendingImg = pendingPreviews[slotKey];
    const existingDoc = existingSlotDocs[slotKey];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {pendingFile ? (
          pendingImg ? (
            <div className="id-doc-thumb">
              <img src={pendingImg} alt={label} />
            </div>
          ) : (
            <div className="id-doc-thumb" style={{ flexDirection: 'column', gap: 4, padding: 8, textAlign: 'center' }}>
              <IconFile size={24} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#2563eb', wordBreak: 'break-all' }}>{pendingFile.name}</span>
            </div>
          )
        ) : existingDoc ? (
          <a href={existingDoc.cloudinary_url} target="_blank" rel="noreferrer" className="id-doc-thumb" title="Click to open full file">
            {isImageDoc(existingDoc) ? (
              <img src={existingDoc.cloudinary_url} alt={existingDoc.title} />
            ) : (
              <div style={{ textAlign: 'center', color: '#2563eb' }}>
                <IconFile size={26} />
                <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3 }}>
                  {(existingDoc.file_format || 'PDF').toUpperCase()} — View
                </div>
              </div>
            )}
          </a>
        ) : null}

        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 7,
            border: '1px dashed #94a3b8',
            background: '#ffffff',
            fontSize: 12,
            fontWeight: 600,
            color: '#1e293b',
            cursor: 'pointer',
          }}
        >
          <IconUpload size={13} />
          <span>{pendingFile ? 'Change File' : existingDoc ? `Update ${label}` : `Upload ${label} (PDF / Image)`}</span>
          <input
            type="file"
            accept="image/*,.pdf"
            style={{ display: 'none' }}
            onChange={(e) => handleSelectSlotFile(slotKey, e.target.files?.[0] || null)}
          />
        </label>
      </div>
    );
  };

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Customer Details & Assets</h2>
          <p className="card-subtitle">
            Search customers by mobile number, manage universal customer fields, and click any customer card to check & choose assets
          </p>
        </div>
        <div className="toolbar-group">
          <button className="btn btn-secondary" onClick={() => setSettingsModal(true)}>
            <IconEdit size={14} /> Universal Customer Settings
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <IconPlus size={15} /> Add Customer
          </button>
        </div>
      </div>

      {/* Mobile Number Search */}
      <div className="toolbar">
        <div className="search-box" style={{ minWidth: 340 }}>
          <IconSearch size={15} />
          <input
            className="input"
            placeholder="Filter by Mobile Number, Name, Aadhaar or PAN..."
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
          />
        </div>
        <span className="badge badge-blue" style={{ padding: '6px 12px', fontSize: 12.5 }}>
          {clients.length} Customer(s)
        </span>
      </div>

      {/* Customer Cards Grid */}
      {loading && clients.length === 0 ? (
        <div className="empty-state">Loading customers...</div>
      ) : clients.length === 0 ? (
        <div className="empty-state" style={{ border: '1px dashed #cbd5e1', borderRadius: 10 }}>
          No customers found. Customers entered or updated in the Live Sheet automatically sync here too!
        </div>
      ) : (
        <div className="cards-grid">
          {clients.map((c) => {
            const extra = c.extra_details && typeof c.extra_details === 'object' ? c.extra_details : {};
            const filledDefaults = universalFields.filter((f) => extra[f.field_key]).slice(0, 2);
            return (
              <div key={c.id} className="customer-card" onClick={() => openVault(c.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: '#0f172a' }}>{c.name}</div>
                    <div style={{ color: '#2563eb', fontWeight: 700, fontSize: 14, marginTop: 2 }}>{c.phone}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    <button className="btn btn-ghost btn-icon" onClick={(e) => openEdit(c, e)} title="Edit Customer">
                      <IconEdit size={14} />
                    </button>
                    {hasPerm('can_delete') && (
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ color: '#e11d48' }}
                        onClick={(e) => deleteClient(c, e)}
                        title="Delete Customer"
                      >
                        <IconTrash size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="badge badge-purple">{c.doc_count} Asset(s)</span>
                  <span className="badge badge-emerald">{c.tx_count} Visits</span>
                </div>

                {(c.aadhaar_number || c.pan_number || extra.bank_account) && (
                  <div style={{ fontSize: 12, background: '#f8fafc', padding: '7px 9px', borderRadius: 7, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {c.aadhaar_number && <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>Aadhaar: {c.aadhaar_number}</div>}
                    {c.pan_number && <div>PAN: <strong>{c.pan_number}</strong></div>}
                    {extra.bank_account && <div>Bank: <strong>{extra.bank_account}</strong></div>}
                  </div>
                )}

                {filledDefaults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: '#475569' }}>
                    {filledDefaults.map((f) => (
                      <div key={f.id}>
                        <span style={{ color: '#64748b' }}>{f.title}:</span> <strong>{String(extra[f.field_key])}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, marginTop: 'auto', paddingTop: 4 }}>
                  <span style={{ color: '#059669', fontWeight: 600 }}>Spent: {formatINR(c.total_spent)}</span>
                  <span style={{ color: '#2563eb', fontWeight: 700 }}>Check & Choose Assets →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== UNIVERSAL CUSTOMER DETAIL SETTINGS MODAL ===== */}
      {settingsModal && (
        <div className="modal-backdrop" onClick={() => setSettingsModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Universal Customer Detail Settings</div>
                <div className="card-subtitle">Fields configured here appear automatically for every customer</div>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSettingsModal(false)}>
                <IconClose size={18} />
              </button>
            </div>

            <div className="modal-body">
              <form
                onSubmit={handleAddDefaultField}
                style={{ padding: 14, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>+ Add Universal Customer Field</div>
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Field Title *</label>
                    <input
                      className="input"
                      value={newField.title}
                      onChange={(e) => setNewField((p) => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Father Name, Passport No, Voter ID"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Data Type</label>
                    <select
                      className="select"
                      value={newField.data_type}
                      onChange={(e) => setNewField((p) => ({ ...p, data_type: e.target.value }))}
                    >
                      {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                    <label className="perm-check" style={{ background: '#fff' }}>
                      <input
                        type="checkbox"
                        checked={newField.is_required}
                        onChange={(e) => setNewField((p) => ({ ...p, is_required: e.target.checked }))}
                      />
                      Required Field
                    </label>
                  </div>
                </div>

                {newField.data_type === 'select' && (
                  <div className="form-group">
                    <label className="form-label">Dropdown Options (comma separated)</label>
                    <input
                      className="input"
                      value={newField.options}
                      onChange={(e) => setNewField((p) => ({ ...p, options: e.target.value }))}
                      placeholder="Option 1, Option 2, Option 3"
                    />
                  </div>
                )}

                <div>
                  <button type="submit" className="btn btn-primary btn-sm">
                    <IconPlus size={14} /> Add Field
                  </button>
                </div>
              </form>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Field Title (Editable)</th>
                      <th>Data Type</th>
                      <th style={{ textAlign: 'center' }}>Required</th>
                      <th style={{ width: 70 }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {universalFields.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <input
                            className="input"
                            style={{ padding: '5px 8px', fontSize: 13 }}
                            defaultValue={f.title}
                            onBlur={(e) => handleRenameDefaultField(f, e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="select"
                            style={{ padding: '5px 8px', fontSize: 12.5, width: 170 }}
                            value={f.data_type}
                            onChange={(e) => handleUpdateDefaultField(f, { data_type: e.target.value })}
                          >
                            {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(f.is_required)}
                            onChange={(e) => handleUpdateDefaultField(f, { is_required: e.target.checked })}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            style={{ color: '#e11d48' }}
                            onClick={() => handleDeleteDefaultField(f)}
                          >
                            <IconTrash size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {universalFields.length === 0 && (
                      <tr><td colSpan={4} className="empty-state">No universal fields yet. Add one above!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setSettingsModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD / EDIT CUSTOMER MODAL (NO STORE, NO AADHAAR WORDS, INLINE AADHAAR/PAN/BANK UPLOADS, PINNED SAVE BUTTON!) ===== */}
      {clientModal && (
        <div className="modal-backdrop" onClick={() => setClientModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editingClient ? `Edit Customer: ${editingClient.name}` : 'Add Customer'}</div>
              <button className="btn btn-ghost btn-icon" onClick={() => setClientModal(false)}><IconClose size={18} /></button>
            </div>
            <form onSubmit={saveClient}>
              <div className="modal-body">
                {/* Row 1: Customer Name + Mobile Number + Date of Birth */}
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Customer Name *</label>
                    <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile Number * (Numbers Only)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="input"
                      value={form.phone}
                      onKeyDown={(e) => blockNonNumericKey(e, false)}
                      onChange={(e) => setForm((p) => ({ ...p, phone: sanitizeNumber(e.target.value, false) }))}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input type="date" className="input" value={form.dob} onChange={(e) => setForm((p) => ({ ...p, dob: e.target.value }))} />
                  </div>
                </div>

                {/* Row 2: Aadhaar + Upload | PAN + Upload | Bank Account Details + Upload */}
                <div className="form-grid-3">
                  <div className="id-doc-card">
                    <div className="form-group">
                      <label className="form-label">Aadhaar Number</label>
                      <input
                        className="input"
                        inputMode="numeric"
                        value={form.aadhaar_number}
                        onChange={(e) => setForm((p) => ({ ...p, aadhaar_number: formatAadhaar(e.target.value) }))}
                        placeholder="XXXX XXXX XXXX"
                      />
                    </div>
                    {renderSlotPreview('aadhaar', 'Aadhaar')}
                  </div>

                  <div className="id-doc-card">
                    <div className="form-group">
                      <label className="form-label">PAN Number</label>
                      <input
                        className="input"
                        value={form.pan_number}
                        onChange={(e) => setForm((p) => ({ ...p, pan_number: e.target.value.toUpperCase() }))}
                        placeholder="ABCDE1234F"
                      />
                    </div>
                    {renderSlotPreview('pan', 'PAN')}
                  </div>

                  <div className="id-doc-card">
                    <div className="form-group">
                      <label className="form-label">Bank Account Details</label>
                      <input
                        className="input"
                        value={form.bank_account}
                        onChange={(e) => setForm((p) => ({ ...p, bank_account: e.target.value }))}
                        placeholder="A/C No, IFSC, Bank Name"
                      />
                    </div>
                    {renderSlotPreview('bank', 'Passbook')}
                  </div>
                </div>

                {/* Row 3: Ration / Smart Card + Address + Notes */}
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Ration / Smart Card</label>
                    <input className="input" value={form.ration_card} onChange={(e) => setForm((p) => ({ ...p, ration_card: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input className="input" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input className="input" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
                  </div>
                </div>

                {/* Universal Customer Details (Configured in Universal Customer Settings) */}
                {universalFields.length > 0 && (
                  <div style={{ padding: 13, borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
                      Universal Customer Details
                    </div>
                    <div className="form-grid-2">
                      {universalFields.map((field) => (
                        <div key={field.id} className="form-group">
                          <label className="form-label">
                            {field.title} {field.is_required ? '*' : ''}
                          </label>
                          {renderDynamicInput(field, form.extra_details?.[field.field_key] || '', (val) =>
                            setForm((p) => ({ ...p, extra_details: { ...(p.extra_details || {}), [field.field_key]: val } }))
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra Custom Fields for This Specific Customer */}
                <div style={{ padding: 13, borderRadius: 9, background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#5b21b6' }}>
                      Extra Custom Details for This Customer (Title + Data Type)
                    </div>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addPerClientCustomItem}>
                      <IconPlus size={13} /> Add Field
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(form.custom_items || []).map((item, idx) => (
                      <div
                        key={idx}
                        style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 1.4fr auto', gap: 8, alignItems: 'center' }}
                      >
                        <input
                          className="input"
                          placeholder="Title (e.g. Driving License)"
                          value={item.title}
                          onChange={(e) => updatePerClientCustomItem(idx, { title: e.target.value })}
                        />
                        <select
                          className="select"
                          value={item.data_type || 'text'}
                          onChange={(e) => updatePerClientCustomItem(idx, { data_type: e.target.value, value: '' })}
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="phone">Mobile</option>
                          <option value="date">Date</option>
                          <option value="email">Email</option>
                          <option value="yesno">Yes / No</option>
                        </select>
                        {renderDynamicInput(
                          { data_type: item.data_type || 'text', is_required: false },
                          item.value || '',
                          (val) => updatePerClientCustomItem(idx, { value: val })
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          style={{ color: '#e11d48' }}
                          onClick={() => removePerClientCustomItem(idx)}
                        >
                          <IconTrash size={14} />
                        </button>
                      </div>
                    ))}
                    {(form.custom_items || []).length === 0 && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Click "+ Add Field" to store any extra detail (with any title & data type) for this customer.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Always-Visible Pinned Save Footer */}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setClientModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving & Uploading...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== CUSTOMER ASSETS PICKER & PROFILE MODAL ===== */}
      {vaultModal && (
        <div className="modal-backdrop" onClick={() => setVaultModal(null)}>
          <div className="modal modal-xl" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">
                  {vaultModal.client ? `${vaultModal.client.name} — Details & Assets` : 'Loading Customer...'}
                </div>
                {vaultModal.client && (
                  <div className="card-subtitle">
                    Mobile: <strong>{vaultModal.client.phone}</strong>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {vaultModal.client && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openEdit(vaultModal.client)}
                  >
                    <IconEdit size={13} /> Edit Details
                  </button>
                )}
                <button className="btn btn-ghost btn-icon" onClick={() => setVaultModal(null)}>
                  <IconClose size={18} />
                </button>
              </div>
            </div>

            <div className="modal-body">
              {loadingVault || !vaultModal.client ? (
                <div className="empty-state">Loading assets...</div>
              ) : (
                <>
                  {/* Customer Profile + Dynamic Details Summary */}
                  <div style={{ padding: 13, borderRadius: 9, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                    {vaultModal.client.aadhaar_number && (
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Aadhaar Number</div>
                        <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{vaultModal.client.aadhaar_number}</div>
                      </div>
                    )}
                    {vaultModal.client.pan_number && (
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>PAN Number</div>
                        <div style={{ fontWeight: 700 }}>{vaultModal.client.pan_number}</div>
                      </div>
                    )}
                    {vaultModal.client.extra_details?.bank_account && (
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Bank Account Details</div>
                        <div style={{ fontWeight: 700 }}>{vaultModal.client.extra_details.bank_account}</div>
                      </div>
                    )}
                    {vaultModal.client.ration_card && (
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Ration / Smart Card</div>
                        <div style={{ fontWeight: 700 }}>{vaultModal.client.ration_card}</div>
                      </div>
                    )}
                    {vaultModal.client.address && (
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Address</div>
                        <div style={{ fontSize: 12.5 }}>{vaultModal.client.address}</div>
                      </div>
                    )}
                    {universalFields.map((f) => {
                      const val = vaultModal.client.extra_details?.[f.field_key];
                      if (!val) return null;
                      return (
                        <div key={f.id}>
                          <div style={{ fontSize: 11, color: '#64748b' }}>{f.title}</div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{String(val)}</div>
                        </div>
                      );
                    })}
                    {(vaultModal.client.extra_details?._custom_items || []).map((ci, idx) => (
                      <div key={idx}>
                        <div style={{ fontSize: 11, color: '#7c3aed' }}>{ci.title}</div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{String(ci.value || '—')}</div>
                      </div>
                    ))}
                  </div>

                  {/* Upload Additional Asset to Cloudinary */}
                  <form
                    onSubmit={handleUploadDoc}
                    style={{ padding: 13, borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 10 }}
                  >
                    <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 13.5 }}>Upload Additional Asset (Cloudinary)</div>
                    <div className="form-grid-4">
                      <select className="select" value={docType} onChange={(e) => setDocType(e.target.value)}>
                        {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <input className="input" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Asset name / label" />
                      <input type="file" className="input" style={{ padding: 5 }} accept="image/*,.pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} required />
                      <button type="submit" className="btn btn-primary" disabled={uploadingDoc}>
                        <IconUpload size={14} /> {uploadingDoc ? 'Uploading...' : 'Upload Asset'}
                      </button>
                    </div>
                  </form>

                  {/* Choose / Multi-Select Assets Action Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontWeight: 700 }}>
                      Assets ({vaultModal.documents.length}) — Click to choose
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {vaultModal.documents.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setSelectedAssetIds(
                              selectedAssetIds.length === vaultModal.documents.length
                                ? []
                                : vaultModal.documents.map((d) => d.id)
                            )
                          }
                        >
                          {selectedAssetIds.length === vaultModal.documents.length ? 'Unselect All' : 'Choose All'}
                        </button>
                      )}
                      {selectedAssetIds.length > 0 && (
                        <>
                          <button type="button" className="btn btn-emerald btn-sm" onClick={openChosenAssets}>
                            Open / Print Chosen ({selectedAssetIds.length})
                          </button>
                          <button type="button" className="btn btn-primary btn-sm" onClick={copyChosenLinks}>
                            Copy Chosen Links
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {vaultModal.documents.length === 0 ? (
                    <div className="empty-state" style={{ padding: 24, border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                      No assets uploaded for this customer yet.
                    </div>
                  ) : (
                    <div className="doc-grid">
                      {vaultModal.documents.map((doc) => {
                        const isChosen = selectedAssetIds.includes(doc.id);
                        return (
                          <div
                            key={doc.id}
                            className={`doc-card ${isChosen ? 'asset-selected' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => toggleAssetSelect(doc.id)}
                          >
                            <div className="doc-preview">
                              {isImageDoc(doc) ? (
                                <img src={doc.cloudinary_url} alt={doc.title} />
                              ) : (
                                <div style={{ textAlign: 'center', color: '#475569' }}>
                                  <IconFile size={32} />
                                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4 }}>{(doc.file_format || 'PDF').toUpperCase()}</div>
                                </div>
                              )}
                            </div>
                            <div className="doc-info">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="badge badge-blue">{doc.doc_type}</span>
                                <input
                                  type="checkbox"
                                  checked={isChosen}
                                  onChange={() => toggleAssetSelect(doc.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ width: 16, height: 16, accentColor: '#2563eb' }}
                                />
                              </div>
                              <div style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {doc.title}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{formatDate(doc.created_at)}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                <a
                                  href={doc.cloudinary_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="btn btn-secondary btn-sm"
                                >
                                  Open
                                </a>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-icon"
                                  style={{ color: '#e11d48' }}
                                  onClick={(e) => handleDeleteDoc(doc, e)}
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Recent Sheet History */}
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Customer Sheet History ({vaultModal.transactions.length})</div>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Store</th>
                            <th>Service</th>
                            <th className="num-cell">Amount</th>
                            <th className="num-cell">Total Paid</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vaultModal.transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td>{formatDate(tx.entry_date)}</td>
                              <td>{tx.store_name}</td>
                              <td style={{ fontWeight: 600 }}>{tx.service_name || '—'}</td>
                              <td className="num-cell">{formatINR(tx.amount)}</td>
                              <td className="num-cell" style={{ fontWeight: 700 }}>{formatINR(tx.total_payable)}</td>
                            </tr>
                          ))}
                          {vaultModal.transactions.length === 0 && (
                            <tr><td colSpan={5} className="empty-state" style={{ padding: 14 }}>No visits recorded yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
