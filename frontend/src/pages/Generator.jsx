import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import * as api from '../services/api';
import { Settings, Edit2, X } from 'lucide-react';

export default function Generator() {
    const [departments, setDepartments] = useState([]);
    const [allSubjects, setAllSubjects] = useState([]); // All subjects from DB
    const [filteredSubjects, setFilteredSubjects] = useState([]); // Filtered by Year/Sem
    const [facultyList, setFacultyList] = useState([]);

    const [config, setConfig] = useState({
        department_code: '',
        year: '1',
        semester: '1',
        class_name: 'A'
    });

    // allocations: [{ id: Date.now(), subject_code: '', faculty_id: '' }]
    const [allocations, setAllocations] = useState([]);

    const [generatedTimetable, setGeneratedTimetable] = useState(null);
    const [loading, setLoading] = useState(false);
    const [editingSlot, setEditingSlot] = useState(null);
    const [view, setView] = useState('form'); // 'form' or 'timetable'
    const [facultySearch, setFacultySearch] = useState({}); // Map of allocation ID to search string
    const [showFacultyDropdown, setShowFacultyDropdown] = useState({}); // Map of allocation ID to boolean

    useEffect(() => {
        api.getDepartments().then(res => {
            setDepartments(res || []);
            if (res?.length > 0) setConfig(prev => ({ ...prev, department_code: res[0].code }));
        });
        api.getFaculty().then(res => setFacultyList(res || []));
        api.getSubjects().then(res => setAllSubjects(res || []));
    }, []);

    useEffect(() => {
        if (config.department_code) {
            const filtered = allSubjects.filter(s =>
                s.year === parseInt(config.year) &&
                s.semester === parseInt(config.semester) &&
                (s.class_name || 'A') === config.class_name
            );
            setFilteredSubjects(filtered);

            // Auto-calculate initial allocations based on subjects for this year/sem
            // Only add if not already present or if we want to reset (current logic resets)
            const initial = filtered.map(s => ({
                id: s.id,
                subject_code: s.code,
                faculty_ids: s.faculty_ids ? [...s.faculty_ids] : (s.faculty_id ? [s.faculty_id] : [])
            }));
            setAllocations(initial);
        }
    }, [config.department_code, config.year, config.semester, config.class_name, allSubjects]);

    const handleAddAllocation = () => {
        setAllocations([...allocations, { id: Date.now(), subject_code: '', faculty_ids: [] }]);
    };

    const handleRemoveAllocation = (id) => {
        setAllocations(allocations.filter(a => a.id !== id));
    };

    const updateAllocation = (id, field, value) => {
        setAllocations(prev => prev.map(a => {
            if (a.id === id) {
                const updated = { ...a, [field]: value };
                if (field === 'subject_code') {
                    // Auto-fill faculty from Admin setting
                    // Use filteredSubjects to ensure we get the subject for THIS class
                    const sub = filteredSubjects.find(s => s.code === value);
                    if (sub?.faculty_ids) updated.faculty_ids = [...sub.faculty_ids];
                    else if (sub?.faculty_id) updated.faculty_ids = [sub.faculty_id];
                }
                return updated;
            }
            return a;
        }));
    };

    const handleUpdateSlot = (day, period, field, value) => {
        setGeneratedTimetable(prev => prev.map(s => {
            if (s.day === day && s.period === period) {
                const updated = { ...s, [field]: value };
                if (field === 'faculty_id') {
                    const fac = facultyList.find(f => f.id === value);
                    updated.faculty = fac ? fac.name : 'Unknown';
                }
                if (field === 'subject_code') {
                    const sub = allSubjects.find(sb => sb.code === value && (sb.class_name || 'A') === config.class_name);
                    if (sub) {
                        updated.subject_code = sub.code;
                        updated.acronym = sub.acronym;
                    }
                    updated.subject = sub ? sub.name : 'Unknown';
                    if (sub?.faculty_id) {
                        updated.faculty_id = sub.faculty_id;
                        const fac = facultyList.find(f => f.id === sub.faculty_id);
                        updated.faculty = fac ? fac.name : 'Unknown';
                    }
                    if (sub?.room_no) {
                        updated.room = sub.room_no;
                    }
                }
                return updated;
            }
            return s;
        }));
    };

    const handleSaveTimetable = async () => {
        setLoading(true);
        try {
            await api.saveTimetable({ ...config, year: parseInt(config.year), semester: parseInt(config.semester), schedule: generatedTimetable });
            alert("Changes Saved Successfully!");
        } catch (err) { alert("Save Failed: " + err.message); }
        finally { setLoading(false); }
    };

    const handleGenerate = async () => {
        if (!config.department_code || !config.semester || !config.year || !config.class_name) {
            alert("Please fill all configuration fields");
            return;
        }

        const payload = {
            ...config,
            year: parseInt(config.year),
            semester: parseInt(config.semester),
            subject_allocations: allocations.filter(a => a.subject_code).map(a => ({
                subject_code: a.subject_code,
                faculty_ids: a.faculty_ids
            }))
        };

        setLoading(true);
        try {
            const res = await api.generateTimetable(payload);
            setGeneratedTimetable(res.schedule);
            setView('timetable');
            alert("Timetable Generated Successfully!");
        } catch (err) {
            alert("Generation Failed: " + (err.response?.data?.detail || err.message));
        } finally { setLoading(false); }
    };

    const timeSlots = ["9:00 AM - 9:50 AM", "9:50 AM - 10:40 AM", "INTERVAL", "10:50 AM - 11:40 AM", "11:40 AM - 12:30 PM", "LUNCH", "1:30 PM - 2:20 PM", "2:20 PM - 3:10 PM", "3:10 PM - 4:00 PM"];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const getSlotContent = (day, timeIdx) => {
        if (timeIdx === 2) return <div className="font-bold text-gray-400 rotate-90 no-print">INTERVAL</div>;
        if (timeIdx === 5) return <div className="font-bold text-gray-400 rotate-90 no-print">LUNCH</div>;
        let period = timeIdx + 1;
        if (timeIdx > 2) period--;
        if (timeIdx > 5) period--;

        const slot = generatedTimetable?.find(s => s.day === day && s.period === period);
        const isEditing = editingSlot?.day === day && editingSlot?.period === period;

        if (!slot) return <button onClick={() => setEditingSlot({ day, period })} className="w-full h-full text-gray-200 hover:text-orodha-purple transition">+</button>;

        if (isEditing) {
            return (
                <div className="p-1 space-y-1 bg-white shadow-inner rounded border border-orodha-purple scale-110 z-10 relative">
                    <select className="w-full text-[9px] border rounded" value={slot.subject_code || ''} onChange={e => handleUpdateSlot(day, period, 'subject_code', e.target.value)}>
                        <option value="">Subject...</option>
                        {allSubjects.map(s => <option key={s.id} value={s.code}>[{s.code}] {s.name}</option>)}
                    </select>
                    <select className="w-full text-[9px] border rounded" value={slot.faculty_id || ''} onChange={e => handleUpdateSlot(day, period, 'faculty_id', e.target.value)}>
                        <option value="">Faculty...</option>
                        {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                    <input className="w-full text-[9px] border rounded p-0.5" value={slot.room || ''} onChange={e => handleUpdateSlot(day, period, 'room', e.target.value)} placeholder="Room" />
                    <button onClick={() => setEditingSlot(null)} className="w-full bg-orodha-purple text-white text-[8px] rounded py-0.5">DONE</button>
                </div>
            );
        }

        return (
            <div onClick={() => setEditingSlot({ day, period })} className="flex flex-col gap-1 p-1 cursor-pointer hover:bg-white transition">
                <div className="bg-orange-400 text-white text-[10px] font-bold py-0.5 px-1 rounded uppercase tracking-tighter truncate">{slot.faculty}</div>
                <div className="text-[11px] font-bold text-gray-800 leading-tight">{slot.acronym || slot.subject_code || slot.subject}</div>
                <div className="bg-blue-500 text-white text-[9px] py-0.5 px-1 rounded truncate">{slot.room}</div>
            </div>
        );
    };

    return (
        <Layout title="Timetable Generation">
            <style>
                {`
                @media print {
                    .no-print, header, aside, .w-64 { display: none !important; }
                    .print-only { display: block !important; }
                    .main-content, .flex-1 { margin-left: 0 !important; padding: 0 !important; width: 100% !important; }
                    body, html { background: white !important; }
                    .max-w-7xl { max-width: none !important; width: 100% !important; margin: 0 !important; }
                    .bg-white { box-shadow: none !important; border: none !important; }
                }
                `}
            </style>
            <div className="max-w-7xl mx-auto">
                {view === 'form' ? (
                    /* FULL PAGE FORM VIEW */
                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-2xl mx-auto">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="font-bold text-2xl text-orodha-purple uppercase tracking-tight">Configuration</h3>
                            {generatedTimetable && (
                                <button
                                    onClick={() => setView('timetable')}
                                    className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold text-xs hover:bg-gray-200 transition flex items-center gap-2 uppercase tracking-wider"
                                >
                                    View Current Timetable
                                </button>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Department</label>
                                <select className="w-full border-2 border-gray-100 p-3.5 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition" value={config.department_code} onChange={e => setConfig({ ...config, department_code: e.target.value })}>
                                    {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Year</label>
                                    <select className="w-full border-2 border-gray-100 p-3.5 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition" value={config.year} onChange={e => setConfig({ ...config, year: e.target.value })}>
                                        {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Semester</label>
                                    <select className="w-full border-2 border-gray-100 p-3.5 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition" value={config.semester} onChange={e => setConfig({ ...config, semester: e.target.value })}>
                                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Class Section</label>
                                <select className="w-full border-2 border-gray-100 p-3.5 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition" value={config.class_name} onChange={e => setConfig({ ...config, class_name: e.target.value })}>
                                    {['A', 'B'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="pt-8 border-t mt-8">
                                <h3 className="text-md font-bold mb-6 flex items-center gap-3 text-gray-700">
                                    <span className="w-8 h-8 rounded-full bg-orodha-purple text-white flex items-center justify-center text-xs font-black shadow-lg shadow-purple-200">2</span>
                                    ALLOCATE FACULTY
                                </h3>
                                <div className="space-y-4 mb-8">
                                    {allocations.map((alloc) => (
                                        <div key={alloc.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4 hover:shadow-md transition duration-300">
                                            <div className="grid grid-cols-2 gap-4 flex-1">
                                                <select
                                                    className="w-full bg-white border-2 border-gray-100 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orodha-purple transition"
                                                    value={alloc.subject_code}
                                                    onChange={e => updateAllocation(alloc.id, 'subject_code', e.target.value)}
                                                >
                                                    <option value="">Subject...</option>
                                                    {filteredSubjects.map(s => <option key={s.id} value={s.code}>[{s.code}] {s.name}</option>)}
                                                </select>
                                                <div className="relative">
                                                    <div className="min-h-[42px] w-full bg-white border-2 border-gray-100 p-1 rounded-xl text-sm outline-none focus-within:ring-2 focus-within:ring-orodha-purple transition flex flex-wrap gap-1">
                                                        {alloc.faculty_ids?.map(id => {
                                                            const f = facultyList.find(fac => fac.id === id);
                                                            return (
                                                                <span key={id} className="bg-orodha-purple/10 text-orodha-purple px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1">
                                                                    {f?.name || "Unknown"}
                                                                    <X size={14} className="cursor-pointer hover:text-red-500" onClick={() => updateAllocation(alloc.id, 'faculty_ids', alloc.faculty_ids.filter(fid => fid !== id))} />
                                                                </span>
                                                            );
                                                        })}
                                                        <input
                                                            className="flex-1 outline-none p-1 text-sm min-w-[120px]"
                                                            placeholder={(!alloc.faculty_ids || alloc.faculty_ids.length === 0) ? "Assign faculty..." : "Add more..."}
                                                            value={facultySearch[alloc.id] || ''}
                                                            onChange={e => {
                                                                setFacultySearch({ ...facultySearch, [alloc.id]: e.target.value });
                                                                setShowFacultyDropdown({ ...showFacultyDropdown, [alloc.id]: true });
                                                            }}
                                                            onFocus={() => setShowFacultyDropdown({ ...showFacultyDropdown, [alloc.id]: true })}
                                                        />
                                                    </div>

                                                    {showFacultyDropdown[alloc.id] && facultySearch[alloc.id] && (
                                                        <div className="absolute z-10 w-full mt-1 bg-white border rounded shadow-xl max-h-48 overflow-y-auto">
                                                            {facultyList
                                                                .filter(f => f.name.toLowerCase().includes(facultySearch[alloc.id].toLowerCase()) && !alloc.faculty_ids?.includes(f.id))
                                                                .map(f => (
                                                                    <div
                                                                        key={f.id}
                                                                        className="p-2 hover:bg-gray-100 cursor-pointer text-sm font-medium"
                                                                        onClick={() => {
                                                                            updateAllocation(alloc.id, 'faculty_ids', [...(alloc.faculty_ids || []), f.id]);
                                                                            setFacultySearch({ ...facultySearch, [alloc.id]: '' });
                                                                            setShowFacultyDropdown({ ...showFacultyDropdown, [alloc.id]: false });
                                                                        }}
                                                                    >
                                                                        {f.name} <span className="text-gray-400 text-xs">- {f.department_code}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={() => handleRemoveAllocation(alloc.id)} className="text-red-300 hover:text-red-600 transition p-2 bg-white rounded-lg shadow-sm">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={handleAddAllocation} className="w-full border-2 border-dashed border-gray-200 py-4 rounded-2xl text-xs font-black text-gray-400 hover:border-orodha-purple hover:text-orodha-purple hover:bg-purple-50 transition duration-300 uppercase tracking-widest">+ ADD SUBJECT ALLOCATION</button>
                                </div>

                                <button
                                    onClick={handleGenerate}
                                    disabled={loading}
                                    className="w-full bg-orodha-purple hover:bg-purple-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-purple-200 transition active:scale-[0.98] disabled:bg-gray-200 uppercase tracking-[0.2em] text-sm"
                                >
                                    {loading ? 'GENERATING TIMETABLE...' : 'GENERATE TIMETABLE ✨'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* FULL PAGE TIMETABLE VIEW */
                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-t-[12px] border-orodha-pink">
                            <div className="flex justify-between items-center mb-10">
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={() => setView('form')}
                                        className="no-print bg-gray-50 p-4 rounded-2xl text-gray-600 hover:bg-orodha-purple hover:text-white transition-all duration-300 shadow-sm"
                                        title="Back to Config"
                                    >
                                        <Edit2 size={24} />
                                    </button>
                                    <div className="bg-gradient-to-r from-orodha-pink to-pink-500 text-white px-8 py-3 rounded-full font-black text-sm tracking-[0.1em] uppercase shadow-lg shadow-pink-100">
                                        {config.department_code} • YEAR {config.year} • {config.class_name} SECTION
                                    </div>
                                </div>
                                <div className="flex gap-4 no-print">
                                    <button onClick={handleSaveTimetable} disabled={loading} className="bg-orodha-purple text-white px-8 py-3 rounded-2xl font-black text-sm shadow-xl shadow-purple-100 hover:bg-purple-700 transition active:scale-95 uppercase tracking-wider">SAVE SCHEDULE</button>
                                    <button onClick={() => window.print()} className="bg-gray-50 hover:bg-gray-100 text-gray-800 px-6 py-3 rounded-2xl font-black text-sm transition uppercase tracking-wider border border-gray-100">PRINT PDF</button>
                                </div>
                            </div>

                            <div className="overflow-x-auto pb-4 scrollbar-hide">
                                <table className="w-full table-fixed border-separate border-spacing-2">
                                    <thead>
                                        <tr>
                                            <th className="w-24 bg-gray-50/50 p-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">DAY / PERIOD</th>
                                            {timeSlots.map((time, idx) => (
                                                <th key={idx} className={`p-3 text-[10px] font-black text-gray-500 uppercase border-b-4 transition-all ${idx === 2 || idx === 5 ? 'bg-gray-50/30' : 'border-orodha-purple/20 hover:border-orodha-purple'}`}>
                                                    {time.split(' - ').map((t, i) => <div key={i} className={i === 0 ? "text-gray-800" : ""}>{t}</div>)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {days.map(day => (
                                            <tr key={day} className="h-32">
                                                <td className="bg-gray-50/50 border-r-4 border-orodha-purple p-3 text-center text-[12px] font-black text-orodha-purple uppercase tracking-tighter leading-none">{day.slice(0, 3)}</td>
                                                {timeSlots.map((_, idx) => (
                                                    <td key={idx} className={`rounded-2xl border-2 border-gray-50 overflow-hidden text-center transition-all duration-300 ${idx === 2 || idx === 5 ? 'bg-gray-50/50 grayscale' : 'hover:border-orodha-purple/30 hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-1'}`}>
                                                        {getSlotContent(day, idx)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
