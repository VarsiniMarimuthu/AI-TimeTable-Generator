import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { DataTable } from '../components/DataTable';
import { getSubjects, addSubject, updateSubject, deleteSubject, getDepartments, getFaculty } from '../services/api';

export default function Subjects() {
    const [subjects, setSubjects] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [facultyList, setFacultyList] = useState([]);
    const [formData, setFormData] = useState({ name: '', code: '', type: 'Theory', weekly_hours: 3, department_code: '', semester: '', year: 1, faculty_id: '' });
    const [editingId, setEditingId] = useState(null);
    const [filterYear, setFilterYear] = useState('all');
    const [filterSemester, setFilterSemester] = useState('all');
    const [filterClass, setFilterClass] = useState('all');

    // Get user role from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [subRes, deptRes, facRes] = await Promise.all([
                getSubjects(),
                getDepartments(),
                getFaculty()
            ]);
            setSubjects(subRes);
            setDepartments(deptRes);
            setFacultyList(facRes);
            if (!editingId && deptRes.length > 0 && !formData.department_code) {
                setFormData(prev => ({ ...prev, department_code: deptRes[0].code }));
            }
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.code || !formData.department_code || !formData.semester) {
            alert("Please fill all required fields");
            return;
        }

        try {
            const payload = {
                ...formData,
                weekly_hours: parseInt(formData.weekly_hours),
                semester: parseInt(formData.semester),
                year: parseInt(formData.year)
            };

            if (editingId) {
                await updateSubject(editingId, payload);
                alert('Subject Updated');
            } else {
                await addSubject(payload);
                alert('Subject Added');
            }
            setFormData({ name: '', code: '', type: 'Theory', weekly_hours: 3, department_code: departments[0]?.code || '', semester: '', year: 1, class_name: 'A', faculty_id: '' });
            setEditingId(null);
            loadData();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const handleEdit = (sub) => {
        setFormData({
            name: sub.name,
            code: sub.code,
            type: sub.type,
            weekly_hours: sub.weekly_hours,
            department_code: sub.department_code,
            semester: sub.semester,
            year: sub.year || 1,
            class_name: sub.class_name || 'A',
            faculty_id: sub.faculty_id || ''
        });
        setEditingId(sub.id);
    };

    const handleDelete = async (row) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            await deleteSubject(row.id);
            alert("Deleted");
            loadData();
        } catch (e) { alert("Delete failed: " + e.message); }
    };

    return (
        <Layout title="Manage Subjects">
            <div className={isAdmin ? "flex gap-8" : ""}>
                {/* Only show form for Admin users */}
                {isAdmin && (
                    <div className="w-1/3 bg-white p-6 rounded shadow h-fit max-h-[85vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-4 text-orodha-purple">{editingId ? 'Edit Subject' : 'Add New Subject'}</h3>
                        <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Subject Name</label>
                                <input className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Subject Code</label>
                                    <input className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Type</label>
                                    <select className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                        <option>Theory</option>
                                        <option>Lab</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Year (1-4)</label>
                                    <input type="number" className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} min="1" max="4" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Semester</label>
                                    <input type="number" className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.semester} onChange={e => setFormData({ ...formData, semester: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Department</label>
                                <select className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.department_code} onChange={e => setFormData({ ...formData, department_code: e.target.value })}>
                                    {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Default Faculty</label>
                                <select className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.faculty_id} onChange={e => setFormData({ ...formData, faculty_id: e.target.value })}>
                                    <option value="">Choose Instructor...</option>
                                    {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Weekly Hours</label>
                                <input type="number" className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.weekly_hours} onChange={e => setFormData({ ...formData, weekly_hours: e.target.value })} />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={handleSubmit} className="flex-1 bg-orodha-purple text-white py-3 rounded-lg font-bold shadow-lg transition active:scale-95">{editingId ? 'UPDATE SUBJECT' : 'ADD SUBJECT'}</button>
                                {editingId && <button onClick={() => { setEditingId(null); setFormData(prev => ({ ...prev, name: '', code: '', semester: '', faculty_id: '' })); }} className="bg-gray-100 text-gray-600 px-4 rounded-lg font-bold">Cancel</button>}
                            </div>
                        </form>
                    </div>
                )}
                <div className={isAdmin ? "flex-1 space-y-8" : "space-y-8"}>
                    {/* Filter Bar */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
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
                                {(filterYear !== 'all' || filterSemester !== 'all') && (
                                    <button
                                        onClick={() => { setFilterYear('all'); setFilterSemester('all'); }}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold transition"
                                    >
                                        Clear Filters
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-700 mb-3 uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Theory Subjects
                        </h4>
                        <DataTable
                            headers={['Subject Code', 'Name', 'Year', 'Sem', 'Faculty']}
                            data={subjects
                                .filter(s => s.type === 'Theory')
                                .filter(s => filterSemester === 'all' || s.semester === parseInt(filterSemester))
                                .map(s => ({
                                    ...s,
                                    subject_code: s.code,
                                    faculty: facultyList.find(f => f.id === s.faculty_id)?.name || 'Not Assigned',
                                    sem: s.semester
                                }))}
                            onEdit={isAdmin ? handleEdit : null}
                            onDelete={isAdmin ? handleDelete : null}
                            showActions={isAdmin}
                        />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-700 mb-3 uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                            Lab Subjects
                        </h4>
                        <DataTable
                            headers={['Subject Code', 'Name', 'Year', 'Sem', 'Faculty']}
                            data={subjects
                                .filter(s => s.type === 'Lab')
                                .filter(s => filterSemester === 'all' || s.semester === parseInt(filterSemester))
                                .map(s => ({
                                    ...s,
                                    subject_code: s.code,
                                    faculty: facultyList.find(f => f.id === s.faculty_id)?.name || 'Not Assigned',
                                    sem: s.semester
                                }))}
                            onEdit={isAdmin ? handleEdit : null}
                            onDelete={isAdmin ? handleDelete : null}
                            showActions={isAdmin}
                        />
                    </div>
                </div>
            </div>
        </Layout>
    );
}
