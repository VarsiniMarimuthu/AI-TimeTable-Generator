import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { DataTable } from '../components/DataTable';
import { getSubjects, addSubject, updateSubject, deleteSubject, getDepartments, getFaculty, getRooms } from '../services/api';
import { X, Search, Rocket, BrainCircuit } from 'lucide-react';

export default function Subjects() {
    const [subjects, setSubjects] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [facultyList, setFacultyList] = useState([]);
    const [roomList, setRoomList] = useState([]);
    const [formData, setFormData] = useState({ name: '', code: '', type: 'Theory', weekly_hours: 3, department_code: '', semester: '', year: 1, class_name: 'A', faculty_ids: [], acronym: '', room_no: '' });
    const [editingId, setEditingId] = useState(null);
    const [filterYear, setFilterYear] = useState('all');
    const [filterSemester, setFilterSemester] = useState('all');
    const [filterClass, setFilterClass] = useState('all');
    const [facultySearch, setFacultySearch] = useState('');
    const [showFacultyDropdown, setShowFacultyDropdown] = useState(false);

    // Get user role from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = user.role === 'admin';

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            const [subRes, deptRes, facRes, roomRes] = await Promise.all([
                getSubjects(),
                getDepartments(),
                getFaculty(),
                getRooms()
            ]);
            setSubjects(subRes);
            setDepartments(deptRes);
            setFacultyList(facRes);
            setRoomList(roomRes || []);
            if (!editingId && deptRes.length > 0 && !formData.department_code) {
                setFormData(prev => ({ ...prev, department_code: deptRes[0].code }));
            }
        } catch (err) { console.error(err); }
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.code || !formData.department_code || !formData.semester || !formData.class_name) {
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
            setFormData({ name: '', code: '', type: 'Theory', weekly_hours: 3, department_code: departments[0]?.code || '', semester: '', year: 1, class_name: 'A', faculty_ids: [], acronym: '', room_no: '' });
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
            faculty_ids: sub.faculty_ids ? [...sub.faculty_ids] : (sub.faculty_id ? [sub.faculty_id] : []),
            acronym: sub.acronym || '',
            room_no: sub.room_no || ''
        });
        setEditingId(sub.id);
    };

    const handleDuplicate = (sub) => {
        setFormData({
            name: sub.name,
            code: sub.code,
            type: sub.type,
            weekly_hours: sub.weekly_hours,
            department_code: sub.department_code,
            semester: sub.semester,
            year: sub.year || 1,
            // Smart Toggle: If A -> B, If B -> A
            class_name: sub.class_name === 'A' ? 'B' : 'A',
            faculty_ids: [], // User requested to change faculty, so clear it
            acronym: sub.acronym || '',
            room_no: sub.room_no || '' // Usually rooms are class-specific, but user can clear it if needed
        });
        setEditingId(null);
        // Optional: Scroll to top to see form
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            <div className={isAdmin ? "flex flex-col lg:flex-row gap-8" : ""}>
                {/* Only show form for Admin users */}
                {isAdmin && (
                    <div className="w-full lg:w-1/3 lg:min-w-[350px] bg-white p-6 rounded shadow h-fit max-h-[85vh] overflow-y-auto">
                        <h3 className="font-bold text-lg mb-6 text-orodha-purple">{editingId ? 'Edit Subject' : 'Add New Subject'}</h3>
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
                                        <option>Open Elective</option>
                                        <option>Project Work</option>
                                        <option>Skill Development</option>
                                        <option>Library/Skill Development</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Acronym</label>
                                    <input className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.acronym} onChange={e => setFormData({ ...formData, acronym: e.target.value })} placeholder="e.g. PP" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Weekly Hours</label>
                                    <input type="number" className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.weekly_hours} onChange={e => setFormData({ ...formData, weekly_hours: e.target.value })} />
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
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Class (A/B)</label>
                                <select className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.class_name || 'A'} onChange={e => setFormData({ ...formData, class_name: e.target.value })}>
                                    <option value="A">Class A</option>
                                    <option value="B">Class B</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Department</label>
                                <select className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.department_code} onChange={e => setFormData({ ...formData, department_code: e.target.value })}>
                                    {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Assigned Faculty</label>
                                <div className="relative">
                                    <div className="min-h-[42px] w-full border p-1 rounded focus-within:ring-2 focus-within:ring-orodha-purple outline-none bg-white flex flex-wrap gap-1">
                                        {formData.faculty_ids.map(id => {
                                            const f = facultyList.find(fac => fac.id === id);
                                            return (
                                                <span key={id} className="bg-orodha-purple/10 text-orodha-purple px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                                                    {f?.name || "Unknown"}
                                                    <X size={14} className="cursor-pointer hover:text-red-500" onClick={() => setFormData({ ...formData, faculty_ids: formData.faculty_ids.filter(fid => fid !== id) })} />
                                                </span>
                                            );
                                        })}
                                        <input
                                            className="flex-1 outline-none p-1 text-sm min-w-[100px]"
                                            placeholder={formData.faculty_ids.length === 0 ? "Type to search faculty..." : "Add more..."}
                                            value={facultySearch}
                                            onChange={e => { setFacultySearch(e.target.value); setShowFacultyDropdown(true); }}
                                            onFocus={() => setShowFacultyDropdown(true)}
                                        />
                                    </div>

                                    {showFacultyDropdown && facultySearch && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-xl max-h-48 overflow-y-auto">
                                            {facultyList
                                                .filter(f => f.name.toLowerCase().includes(facultySearch.toLowerCase()) && !formData.faculty_ids.includes(f.id))
                                                .map(f => (
                                                    <div
                                                        key={f.id}
                                                        className="p-2 hover:bg-gray-100 cursor-pointer text-sm font-medium"
                                                        onClick={() => {
                                                            setFormData({ ...formData, faculty_ids: [...formData.faculty_ids, f.id] });
                                                            setFacultySearch('');
                                                            setShowFacultyDropdown(false);
                                                        }}
                                                    >
                                                        {f.name} <span className="text-gray-400 text-xs">- {f.department_code}</span>
                                                    </div>
                                                ))}
                                            {facultyList.filter(f => f.name.toLowerCase().includes(facultySearch.toLowerCase()) && !formData.faculty_ids.includes(f.id)).length === 0 && (
                                                <div className="p-2 text-gray-400 text-sm italic">No matching faculty found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-600 mb-1 tracking-tight">Assigned Room</label>
                                <select className="w-full border p-2 rounded focus:ring-2 focus:ring-orodha-purple outline-none" value={formData.room_no} onChange={e => setFormData({ ...formData, room_no: e.target.value })}>
                                    <option value="">Auto-Assign Room</option>
                                    {roomList.map(r => <option key={r.id} value={r.room_no}>{r.room_no} ({r.type})</option>)}
                                </select>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button onClick={handleSubmit} className="flex-1 bg-orodha-purple text-white py-3 rounded-lg font-bold shadow-lg transition active:scale-95">{editingId ? 'UPDATE SUBJECT' : 'ADD SUBJECT'}</button>
                                {editingId && <button onClick={() => { setEditingId(null); setFormData(prev => ({ ...prev, name: '', code: '', semester: '', faculty_ids: [] })); }} className="bg-gray-100 text-gray-600 px-4 rounded-lg font-bold">Cancel</button>}
                            </div>
                        </form>
                    </div>
                )}
                <div className={isAdmin ? "flex-1 space-y-8 min-w-0" : "space-y-8"}>
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

                    <div>
                        <h4 className="font-bold text-gray-700 mb-3 uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            Theory Subjects
                        </h4>
                        <DataTable
                            headers={['Subject Code', 'Class', 'Acronym', 'Name', 'Year', 'Sem', 'Hours', 'Faculty', 'Room']}
                            data={subjects
                                .filter(s => s.type === 'Theory')
                                .filter(s => filterYear === 'all' || String(s.year) === String(filterYear))
                                .filter(s => filterSemester === 'all' || String(s.semester) === String(filterSemester))
                                .filter(s => filterClass === 'all' || s.class_name === filterClass)
                                .map(s => ({
                                    ...s,
                                    subject_code: s.code,
                                    class: s.class_name || 'A',
                                    acronym: s.acronym || '-',
                                    hours: s.weekly_hours,
                                    faculty: s.faculty_ids && s.faculty_ids.length > 0
                                        ? s.faculty_ids.map(id => facultyList.find(f => f.id === id)?.name).filter(Boolean).join(', ')
                                        : (facultyList.find(f => f.id === s.faculty_id)?.name || 'Not Assigned'),
                                    room: s.room_no || 'Auto',
                                    sem: s.semester
                                }))}
                            onEdit={isAdmin ? handleEdit : null}
                            onDuplicate={isAdmin ? handleDuplicate : null}
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
                            headers={['Subject Code', 'Class', 'Name', 'Year', 'Sem', 'Faculty', 'Room']}
                            data={subjects
                                .filter(s => s.type === 'Lab')
                                .filter(s => filterYear === 'all' || String(s.year) === String(filterYear))
                                .filter(s => filterSemester === 'all' || String(s.semester) === String(filterSemester))
                                .filter(s => filterClass === 'all' || s.class_name === filterClass)
                                .map(s => ({
                                    ...s,
                                    subject_code: s.code,
                                    class: s.class_name || 'A',
                                    faculty: s.faculty_ids && s.faculty_ids.length > 0
                                        ? s.faculty_ids.map(id => facultyList.find(f => f.id === id)?.name).filter(Boolean).join(', ')
                                        : (facultyList.find(f => f.id === s.faculty_id)?.name || 'Not Assigned'),
                                    room: s.room_no || 'Auto',
                                    sem: s.semester
                                }))}
                            onEdit={isAdmin ? handleEdit : null}
                            onDuplicate={isAdmin ? handleDuplicate : null}
                            onDelete={isAdmin ? handleDelete : null}
                            showActions={isAdmin}
                        />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-700 mb-3 uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            Open Elective Subjects
                        </h4>
                        <DataTable
                            headers={['Subject Code', 'Class', 'Acronym', 'Name', 'Year', 'Sem', 'Hours', 'Faculty', 'Room']}
                            data={subjects
                                .filter(s => s.type === 'Open Elective')
                                .filter(s => filterYear === 'all' || String(s.year) === String(filterYear))
                                .filter(s => filterSemester === 'all' || String(s.semester) === String(filterSemester))
                                .filter(s => filterClass === 'all' || s.class_name === filterClass)
                                .map(s => ({
                                    ...s,
                                    subject_code: s.code,
                                    class: s.class_name || 'A',
                                    acronym: s.acronym || '-',
                                    hours: s.weekly_hours,
                                    faculty: s.faculty_ids && s.faculty_ids.length > 0
                                        ? s.faculty_ids.map(id => facultyList.find(f => f.id === id)?.name).filter(Boolean).join(', ')
                                        : (facultyList.find(f => f.id === s.faculty_id)?.name || 'Not Assigned'),
                                    room: s.room_no || 'Auto',
                                    sem: s.semester
                                }))}
                            onEdit={isAdmin ? handleEdit : null}
                            onDuplicate={isAdmin ? handleDuplicate : null}
                            onDelete={isAdmin ? handleDelete : null}
                            showActions={isAdmin}
                        />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-700 mb-3 uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                            Project Work
                        </h4>
                        <DataTable
                            headers={['Subject Code', 'Class', 'Acronym', 'Name', 'Year', 'Sem', 'Hours', 'Faculty', 'Room']}
                            data={subjects
                                .filter(s => s.type === 'Project Work')
                                .filter(s => filterYear === 'all' || String(s.year) === String(filterYear))
                                .filter(s => filterSemester === 'all' || String(s.semester) === String(filterSemester))
                                .filter(s => filterClass === 'all' || s.class_name === filterClass)
                                .map(s => ({
                                    ...s,
                                    subject_code: s.code,
                                    class: s.class_name || 'A',
                                    acronym: s.acronym || '-',
                                    hours: s.weekly_hours,
                                    faculty: s.faculty_ids && s.faculty_ids.length > 0
                                        ? s.faculty_ids.map(id => facultyList.find(f => f.id === id)?.name).filter(Boolean).join(', ')
                                        : (facultyList.find(f => f.id === s.faculty_id)?.name || 'Not Assigned'),
                                    room: s.room_no || 'Auto',
                                    sem: s.semester
                                }))}
                            onEdit={isAdmin ? handleEdit : null}
                            onDuplicate={isAdmin ? handleDuplicate : null}
                            onDelete={isAdmin ? handleDelete : null}
                            showActions={isAdmin}
                        />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-700 mb-3 uppercase tracking-widest text-[10px] flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500"></span>
                            Skill Development / Library
                        </h4>
                        <DataTable
                            headers={['Subject Code', 'Class', 'Acronym', 'Name', 'Year', 'Sem', 'Hours', 'Faculty', 'Room']}
                            data={subjects
                                .filter(s => s.type === 'Skill Development' || s.type === 'Library/Skill Development')
                                .filter(s => filterYear === 'all' || String(s.year) === String(filterYear))
                                .filter(s => filterSemester === 'all' || String(s.semester) === String(filterSemester))
                                .filter(s => filterClass === 'all' || s.class_name === filterClass)
                                .map(s => ({
                                    ...s,
                                    subject_code: s.code,
                                    class: s.class_name || 'A',
                                    acronym: s.acronym || '-',
                                    hours: s.weekly_hours,
                                    faculty: s.faculty_ids && s.faculty_ids.length > 0
                                        ? s.faculty_ids.map(id => facultyList.find(f => f.id === id)?.name).filter(Boolean).join(', ')
                                        : (facultyList.find(f => f.id === s.faculty_id)?.name || 'Not Assigned'),
                                    room: s.room_no || 'Auto',
                                    sem: s.semester
                                }))}
                            onEdit={isAdmin ? handleEdit : null}
                            onDuplicate={isAdmin ? handleDuplicate : null}
                            onDelete={isAdmin ? handleDelete : null}
                            showActions={isAdmin}
                        />
                    </div>
                </div>
            </div>
        </Layout>
    );
}
