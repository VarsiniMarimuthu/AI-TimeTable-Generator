import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import * as api from '../services/api';

export default function Timetables() {
    // This page is for Students to View the generated timetable
    const [departments, setDepartments] = useState([]);
    const [search, setSearch] = useState({ department_code: '', year: '', semester: '', class_name: '' });
    const [timetable, setTimetable] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        // Use student endpoint for public access to departments
        const fetchDepartments = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/student/departments');
                const data = await response.json();
                console.log('Departments loaded:', data);
                setDepartments(data || []);
            } catch (err) {
                console.error('Error loading departments:', err);
            }
        };
        fetchDepartments();
    }, []);


    const handleSearch = async () => {
        if (!search.department_code || !search.year || !search.semester || !search.class_name) {
            alert("Please select Department, Year, Semester, and Class");
            return;
        }
        setLoading(true);
        setSearched(true);
        try {
            const res = await api.getTimetable({
                department_code: search.department_code,
                year: parseInt(search.year),
                semester: parseInt(search.semester),
                class_name: search.class_name
            });
            setTimetable(res.schedule);
        } catch (err) {
            console.error(err);
            setTimetable([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="View Timetables">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mb-6">
                <h3 className="font-bold text-lg mb-4 text-orodha-purple">Search Timetable</h3>
                <div className="grid grid-cols-5 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Department</label>
                        <select
                            className="w-full border-2 border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition"
                            value={search.department_code}
                            onChange={e => setSearch({ ...search, department_code: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {departments.map(d => <option key={d.id} value={d.code}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Year</label>
                        <select
                            className="w-full border-2 border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition"
                            value={search.year}
                            onChange={e => setSearch({ ...search, year: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {[1, 2, 3, 4].map(y => <option key={y} value={y}>Year {y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Semester</label>
                        <select
                            className="w-full border-2 border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition"
                            value={search.semester}
                            onChange={e => setSearch({ ...search, semester: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Sem {s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Class</label>
                        <select
                            className="w-full border-2 border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition"
                            value={search.class_name}
                            onChange={e => setSearch({ ...search, class_name: e.target.value })}
                        >
                            <option value="">Select...</option>
                            {['A', 'B'].map(c => <option key={c} value={c}>Class {c}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-6 py-3 bg-orodha-purple text-white font-black rounded-xl shadow-lg hover:bg-purple-700 transition active:scale-95 uppercase tracking-wider text-sm"
                    >
                        🔍 Search
                    </button>
                </div>
            </div>

            {loading && <div className="text-center py-10">Loading...</div>}

            {!loading && searched && (!timetable || timetable.length === 0) && (
                <div className="text-center py-10 text-gray-500 bg-white rounded shadow">
                    No timetable published for this class yet.
                </div>
            )}

            {!loading && timetable && timetable.length > 0 && (
                <div className="bg-white p-8 rounded-2xl shadow-2xl border-t-8 border-orodha-pink overflow-x-auto">
                    <div className="bg-gradient-to-r from-orodha-pink to-pink-500 text-white px-8 py-3 rounded-full font-black text-sm tracking-[0.1em] uppercase shadow-lg shadow-pink-100 mb-6 text-center inline-block">
                        {search.department_code} • YEAR {search.year} • SEM {search.semester} • CLASS {search.class_name}
                    </div>
                    <table className="w-full table-fixed border-separate border-spacing-2">
                        <thead>
                            <tr>
                                <th className="w-24 bg-gray-50/50 p-4 text-[11px] font-black text-gray-400 uppercase tracking-widest">DAY / PERIOD</th>
                                {["9:00 AM - 9:50 AM", "9:50 AM - 10:40 AM", "INTERVAL", "10:50 AM - 11:40 AM", "11:40 AM - 12:30 PM", "LUNCH", "1:30 PM - 2:20 PM", "2:20 PM - 3:10 PM", "3:10 PM - 4:00 PM"].map((time, idx) => (
                                    <th key={idx} className={`p-3 text-[10px] font-black text-gray-500 uppercase border-b-4 transition-all ${idx === 2 || idx === 5 ? 'bg-gray-50/30' : 'border-orodha-purple/20'}`}>
                                        {time.split(' - ').map((t, i) => <div key={i} className={i === 0 ? "text-gray-800" : ""}>{t}</div>)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                                <tr key={day} className="h-32">
                                    <td className="bg-gray-50/50 border-r-4 border-orodha-purple p-3 text-center text-[12px] font-black text-orodha-purple uppercase tracking-tighter leading-none">{day.slice(0, 3)}</td>
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((timeIdx) => {
                                        if (timeIdx === 2) return <td key={timeIdx} className="rounded-2xl border-2 border-gray-50 bg-gray-50/50 grayscale text-center"><div className="font-bold text-gray-400 rotate-90">INTERVAL</div></td>;
                                        if (timeIdx === 5) return <td key={timeIdx} className="rounded-2xl border-2 border-gray-50 bg-gray-50/50 grayscale text-center"><div className="font-bold text-gray-400 rotate-90">LUNCH</div></td>;
                                        let period = timeIdx + 1;
                                        if (timeIdx > 2) period--;
                                        if (timeIdx > 5) period--;
                                        const slot = timetable.find(s => s.day === day && s.period === period);
                                        return (
                                            <td key={timeIdx} className="rounded-2xl border-2 border-gray-50 overflow-hidden text-center transition-all duration-300 hover:border-orodha-purple/30 hover:shadow-lg hover:shadow-gray-100">
                                                {slot ? (
                                                    <div className="flex flex-col gap-1 p-2">
                                                        <div className="bg-orange-400 text-white text-[10px] font-bold py-0.5 px-1 rounded uppercase tracking-tighter truncate">{slot.faculty}</div>
                                                        <div className="text-[11px] font-bold text-gray-800 leading-tight">{slot.acronym || slot.subject_code || slot.subject}</div>
                                                        <div className="bg-blue-500 text-white text-[9px] py-0.5 px-1 rounded truncate">{slot.room}</div>
                                                    </div>
                                                ) : <span className="text-gray-300">-</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Layout>
    );
}
