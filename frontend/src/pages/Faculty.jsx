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
    const [filterYear, setFilterYear] = useState('all');
    const [filterSemester, setFilterSemester] = useState('all');
    const [filterClass, setFilterClass] = useState('all');

    const [formData, setFormData] = useState({
        name: '', email: '', designation: 'Professor',
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

            setFormData({ name: '', email: '', designation: 'Professor', department_code: departments[0]?.code || '', max_load_per_week: 12 });
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
        // If no filters active, show all
        if (filterYear === 'all' && filterSemester === 'all' && filterClass === 'all') return true;

        // Find all subjects assigned to this faculty
        const assignedSubjects = subjects.filter(s => s.faculty_id === fac.id);

        // If faculty has no subjects but filters are active, hide them? 
        // Or strictly show those who MATCH. Yes, filter usually implies "show matching".
        if (assignedSubjects.length === 0) return false;

        // Check if ANY assigned subject matches the criteria
        return assignedSubjects.some(s => {
            const matchYear = filterYear === 'all' || s.year === parseInt(filterYear);
            const matchSem = filterSemester === 'all' || s.semester === parseInt(filterSemester);
            // Class filter is tricky since Subjects don't have Class anymore (it's common).
            // But if user insists on Class filter, we can't really filter by it unless we assume all subjects apply to all classes.
            // So Class filter effectively does nothing for now unless we re-introduce class-specific subject mapping?
            // For now, let's ignore Class filter logic for the match, or treat as "matches all" since subjects are shared.
            const matchClass = true;

            return matchYear && matchSem && matchClass;
        });
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
                                <input className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.designation} onChange={e => setFormData({ ...formData, designation: e.target.value })} />
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
                            <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Filter By:</span>
                            <div className="flex gap-3">
                                <select
                                    className="border-2 border-gray-200 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-orodha-purple outline-none transition"
                                    value={filterYear}
                                    onChange={e => setFilterYear(e.target.value)}
                                >
                                    <option value="all">All Years</option>
                                    <option value="1">Year 1</option>
                                    <option value="2">Year 2</option>
                                    <option value="3">Year 3</option>
                                    <option value="4">Year 4</option>
                                </select>
                                <select
                                    className="border-2 border-gray-200 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-orodha-purple outline-none transition"
                                    value={filterSemester}
                                    onChange={e => setFilterSemester(e.target.value)}
                                >
                                    <option value="all">All Semesters</option>
                                    <option value="1">Semester 1</option>
                                    <option value="2">Semester 2</option>
                                    <option value="3">Semester 3</option>
                                    <option value="4">Semester 4</option>
                                    <option value="5">Semester 5</option>
                                    <option value="6">Semester 6</option>
                                    <option value="7">Semester 7</option>
                                    <option value="8">Semester 8</option>
                                </select>
                                <select
                                    className="border-2 border-gray-200 px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 focus:ring-2 focus:ring-orodha-purple outline-none transition"
                                    value={filterClass}
                                    onChange={e => setFilterClass(e.target.value)}
                                >
                                    <option value="all">All Classes</option>
                                    <option value="A">Class A</option>
                                    <option value="B">Class B</option>
                                </select>
                                {(filterYear !== 'all' || filterSemester !== 'all' || filterClass !== 'all') && (
                                    <button
                                        onClick={() => { setFilterYear('all'); setFilterSemester('all'); setFilterClass('all'); }}
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
