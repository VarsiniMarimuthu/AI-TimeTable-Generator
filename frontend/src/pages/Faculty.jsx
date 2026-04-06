import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { DataTable } from '../components/DataTable';
import { getFaculty, getDepartments, addFaculty, updateFaculty, deleteFaculty, getSubjects } from '../services/api';

export default function Faculty() {
    const [faculty, setFaculty] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [subjects, setSubjects] = useState([]); // Fetch subjects for filtering
    const [editingId, setEditingId] = useState(null);

    // Filters
    const [filterDept, setFilterDept] = useState('all');

    const [formData, setFormData] = useState({
        name: '', email: '', designation: 'Assistant Professor',
        department_code: '', max_load_per_week: 12
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [facRes, deptRes, subRes] = await Promise.all([
                getFaculty(),
                getDepartments(),
                getSubjects()
            ]);
            setFaculty(facRes);
            setDepartments(deptRes);
            setSubjects(subRes);
            if (!editingId && deptRes.length > 0 && !formData.department_code) {
                setFormData(prev => ({ ...prev, department_code: deptRes[0].code }));
            }
        } catch (err) { console.error(err); }
    };


    const handleSubmit = async () => {
        if (!formData.name || !formData.department_code) {
            alert("Name and Department are required");
            return;
        }
        try {
            const payload = {
                ...formData,
                max_load_per_week: parseInt(formData.max_load_per_week)
            };

            if (editingId) {
                await updateFaculty(editingId, payload);
                alert('Faculty Updated');
            } else {
                await addFaculty(payload);
                alert('Faculty Added');
            }

            setFormData({ name: '', email: '', designation: 'Assistant Professor', department_code: departments[0]?.code || '', max_load_per_week: 12 });
            setEditingId(null);
            loadData();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleEdit = (fac) => {
        setFormData({
            name: fac.name,
            email: fac.email,
            designation: fac.designation,
            department_code: fac.department_code,
            max_load_per_week: fac.max_load_per_week
        });
        setEditingId(fac.id);
    };

    const handleDelete = async (row) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            await deleteFaculty(row.id);
            alert("Deleted");
            loadData();
        } catch (e) { alert("Delete failed: " + e.message); }
    };


    const user = JSON.parse(localStorage.getItem('user')) || { role: 'faculty' };
    const isAdmin = user.role === 'admin';

    // Helper to check if faculty matches filters
    const matchesFilters = (fac) => {
        if (filterDept === 'all') return true;
        return fac.department_code === filterDept;
    };

    return (
        <Layout title="Manage Faculty">
            <div className="flex gap-8">
                {isAdmin && (
                    <div className="w-1/3 bg-white p-6 rounded shadow h-fit max-h-screen overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4 text-orodha-purple">{editingId ? 'Edit Faculty' : 'Add Faculty'}</h3>
                        <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Name</label>
                                <input className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Email</label>
                                <input className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Designation</label>
                                <select className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })}>
                                    <option value="Assistant Professor">Assistant Professor</option>
                                    <option value="Associate Professor">Associate Professor</option>
                                    <option value="Professor">Professor</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Department</label>
                                <select className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.department_code} onChange={e => setFormData({ ...formData, department_code: e.target.value })}>
                                    {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Max Load/Week</label>
                                <input type="number" className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.max_load_per_week} onChange={e => setFormData({ ...formData, max_load_per_week: e.target.value })} />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={handleSubmit} className="flex-1 bg-orodha-purple text-white py-3 rounded-lg font-bold shadow-lg transition active:scale-95">{editingId ? 'UPDATE' : 'ADD'}</button>
                                {editingId && <button onClick={() => { setEditingId(null); setFormData(prev => ({ ...prev, name: '', email: '', designation: 'Professor', max_load_per_week: 12 })); }} className="bg-gray-100 text-gray-600 px-4 rounded-lg font-bold">Cancel</button>}
                            </div>
                        </form>
                    </div>
                )}
                <div className={isAdmin ? "flex-1" : "w-full"}>
                    {/* Visual Filter Bar for Faculty */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 mb-6">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Filter By Dept:</span>
                            <div className="flex gap-3">
                                <select
                                    className="border-2 border-gray-200 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-orodha-purple outline-none transition"
                                    value={filterDept}
                                    onChange={e => setFilterDept(e.target.value)}
                                >
                                    <option value="all">All Departments</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.code}>{d.name}</option>
                                    ))}
                                </select>
                                {filterDept !== 'all' && (
                                    <button
                                        onClick={() => setFilterDept('all')}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold transition"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <DataTable
                        headers={['Name', 'Email', 'Designation', 'Dept', 'Load']}
                        data={faculty
                            .filter(matchesFilters)
                            .map(f => ({
                                ...f,
                                dept: f.department_code,
                                load: f.max_load_per_week
                            }))}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        showActions={isAdmin}
                    />
                </div>
            </div>
        </Layout>
    );
}
