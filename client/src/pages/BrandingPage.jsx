import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { brandingApi, schoolApi } from '../api/client';

export default function BrandingPage() {
  const { user, isSuperAdmin, isMarketing, isOwner } = useAuth();
  const canEditOrg = isSuperAdmin || isMarketing;
  const canEditSchool = isSuperAdmin || isOwner;
  const [tab, setTab] = useState(canEditOrg ? 'org' : 'school');
  const [orgBranding, setOrgBranding] = useState(null);
  const [schoolBranding, setSchoolBranding] = useState(null);
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState(user?.schoolId || '');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (canEditOrg) loadOrgBranding();
    if (isSuperAdmin) {
      loadSchools();
    } else if (isOwner && user?.schoolId) {
      // Owners see only their school
      setSelectedSchoolId(user.schoolId);
      loadSchoolBranding(user.schoolId);
    }
  }, []);

  useEffect(() => {
    // Load school branding when selection changes (for super admin)
    if (selectedSchoolId && isSuperAdmin) {
      loadSchoolBranding(selectedSchoolId);
    }
  }, [selectedSchoolId]);

  const loadOrgBranding = async () => {
    try { setOrgBranding(await brandingApi.getOrg()); } catch (e) { setError(e.message); }
  };

  const loadSchoolBranding = async (schoolId) => {
    try { setSchoolBranding(await brandingApi.getSchool(schoolId)); } catch (e) { setError(e.message); }
  };

  const loadSchools = async () => {
    try { setSchools(await schoolApi.getAll()); } catch {}
  };

  const handleSaveOrg = async () => {
    try {
      setError(''); setSuccess('');
      await brandingApi.updateOrg(form);
      setEditing(false); loadOrgBranding();
      setSuccess('Organization branding updated!');
    } catch (e) { setError(e.message); }
  };

  const handleSaveSchool = async () => {
    try {
      setError(''); setSuccess('');
      await brandingApi.updateSchool(selectedSchoolId, form);
      setEditing(false); loadSchoolBranding(selectedSchoolId);
      setSuccess('School branding updated!');
    } catch (e) { setError(e.message); }
  };

  const startEditOrg = () => {
    setForm({
      primaryColor: orgBranding?.primaryColor || '#1a1a2e',
      secondaryColor: orgBranding?.secondaryColor || '#e94560',
      accentColor: orgBranding?.accentColor || '#0f3460',
      fontFamily: orgBranding?.fontFamily || 'Inter, sans-serif',
      tagline: orgBranding?.tagline || '',
      logoUrl: orgBranding?.logoUrl || '',
      logoLightUrl: orgBranding?.logoLightUrl || '',
    });
    setEditing(true);
  };

  const startEditSchool = () => {
    setForm({
      primaryColor: schoolBranding?.primaryColor || '',
      secondaryColor: schoolBranding?.secondaryColor || '',
      logoUrl: schoolBranding?.logoUrl || '',
      bannerUrl: schoolBranding?.bannerUrl || '',
      description: schoolBranding?.description || '',
      welcomeMessage: schoolBranding?.welcomeMessage || '',
    });
    setEditing(true);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>🎨 Branding</h1>
      </div>
      {error && <div className="error-message">{error}</div>}
      {success && <div style={{ padding: '0.75rem 1rem', background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: '8px', marginBottom: '1rem', color: '#155724' }}>{success}</div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {canEditOrg && <button className={`btn ${tab === 'org' ? '' : 'btn-outline'}`} onClick={() => { setTab('org'); setEditing(false); }}>Organization</button>}
        {canEditSchool && <button className={`btn ${tab === 'school' ? '' : 'btn-outline'}`} onClick={() => { setTab('school'); setEditing(false); }}>School</button>}
      </div>

      {/* Org Branding */}
      {tab === 'org' && (
        <div>
          {/* Preview */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Organization Branding Guidelines</h2>
              {(isSuperAdmin || isMarketing) && !editing && <button className="btn" onClick={startEditOrg}>Edit</button>}
            </div>

            {!editing ? (
              <div>
                {/* Color Palette */}
                <h3>Color Palette</h3>
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                  {[
                    { label: 'Primary', color: orgBranding?.primaryColor },
                    { label: 'Secondary', color: orgBranding?.secondaryColor },
                    { label: 'Accent', color: orgBranding?.accentColor },
                  ].map(({ label, color }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '12px', backgroundColor: color, border: '1px solid #ddd', marginBottom: '0.5rem' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</div>
                      <div style={{ color: '#666', fontSize: '0.8rem' }}>{color}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  <div><strong>Font Family:</strong> <span style={{ fontFamily: orgBranding?.fontFamily }}>{orgBranding?.fontFamily}</span></div>
                  <div><strong>Tagline:</strong> {orgBranding?.tagline || 'Not set'}</div>
                  {orgBranding?.logoUrl && <div><strong>Logo:</strong> <img src={orgBranding.logoUrl} alt="Logo" style={{ maxHeight: '60px', display: 'block', marginTop: '0.5rem' }} /></div>}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  <div className="form-group"><label>Primary Color</label><div style={{ display: 'flex', gap: '0.5rem' }}><input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} style={{ width: '60px', height: '40px', padding: '2px' }} /><input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} /></div></div>
                  <div className="form-group"><label>Secondary Color</label><div style={{ display: 'flex', gap: '0.5rem' }}><input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} style={{ width: '60px', height: '40px', padding: '2px' }} /><input value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} /></div></div>
                  <div className="form-group"><label>Accent Color</label><div style={{ display: 'flex', gap: '0.5rem' }}><input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} style={{ width: '60px', height: '40px', padding: '2px' }} /><input value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} /></div></div>
                  <div className="form-group"><label>Font Family</label><input value={form.fontFamily} onChange={(e) => setForm({ ...form, fontFamily: e.target.value })} /></div>
                  <div className="form-group"><label>Tagline</label><input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></div>
                  <div className="form-group"><label>Logo URL</label><input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} /></div>
                  <div className="form-group"><label>Logo (Light variant) URL</label><input value={form.logoLightUrl} onChange={(e) => setForm({ ...form, logoLightUrl: e.target.value })} /></div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn" onClick={handleSaveOrg}>Save</button>
                  <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* School Branding */}
      {tab === 'school' && (
        <div>
          {isSuperAdmin && (
            <div style={{ marginBottom: '1rem' }}>
              <select value={selectedSchoolId} onChange={(e) => { setSelectedSchoolId(e.target.value); setEditing(false); }}>
                <option value="">Select School</option>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {isOwner && !isSuperAdmin && (
            <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e3f2fd', borderRadius: '8px', color: '#1565c0' }}>
              Customize branding for your school. These settings will appear on student-facing screens and certificates.
            </div>
          )}

          {selectedSchoolId && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>School Branding</h2>
                {canEditSchool && !editing && <button className="btn" onClick={startEditSchool}>Edit</button>}
              </div>

              {!editing ? (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    {schoolBranding?.primaryColor && (
                      <div>
                        <strong>Colors:</strong>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: schoolBranding.primaryColor, border: '1px solid #ddd' }} />
                          {schoolBranding.secondaryColor && <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: schoolBranding.secondaryColor, border: '1px solid #ddd' }} />}
                        </div>
                      </div>
                    )}
                    {schoolBranding?.logoUrl && <div><strong>Logo:</strong><br /><img src={schoolBranding.logoUrl} alt="School Logo" style={{ maxHeight: '60px', marginTop: '0.5rem' }} /></div>}
                    <div><strong>Description:</strong> {schoolBranding?.description || 'Not set'}</div>
                    <div><strong>Welcome Message:</strong> {schoolBranding?.welcomeMessage || 'Not set'}</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div className="form-group"><label>Primary Color</label><div style={{ display: 'flex', gap: '0.5rem' }}><input type="color" value={form.primaryColor || '#ffffff'} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} style={{ width: '60px', height: '40px', padding: '2px' }} /><input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} /></div></div>
                    <div className="form-group"><label>Secondary Color</label><div style={{ display: 'flex', gap: '0.5rem' }}><input type="color" value={form.secondaryColor || '#ffffff'} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} style={{ width: '60px', height: '40px', padding: '2px' }} /><input value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} /></div></div>
                    <div className="form-group"><label>Logo URL</label><input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} /></div>
                    <div className="form-group"><label>Banner URL</label><input value={form.bannerUrl} onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })} /></div>
                  </div>
                  <div className="form-group"><label>Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
                  <div className="form-group"><label>Welcome Message</label><textarea value={form.welcomeMessage} onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })} rows={2} /></div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn" onClick={handleSaveSchool}>Save</button>
                    <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
