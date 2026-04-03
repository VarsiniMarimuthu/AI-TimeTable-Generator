import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import * as api from '../services/api';
import { Search } from 'lucide-react';

export default function FacultyTimetableView() {
    const [facultyList, setFacultyList] = useState([]);
    const [selectedFaculty, setSelectedFaculty] = useState('');
    const [semesterType, setSemesterType] = useState('ODD');
    
    const [scheduleData, setScheduleData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.getFaculty().then(res => {
            setFacultyList(res || []);
            if(res && res.length > 0) setSelectedFaculty(res[0].id);
        });
    }, []);

    const fetchFacultyTimetable = async () => {
        if(!selectedFaculty) return;
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:8000/api/generation/faculty_timetable?faculty_id=${selectedFaculty}&semester_type=${semesterType}`);
            const data = await res.json();
            if(!res.ok) throw new Error(data.detail || "Failed to fetch");
            setScheduleData(data);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const timeSlots = ["9:00 AM - 9:50 AM", "9:50 AM - 10:40 AM", "INTERVAL", "10:50 AM - 11:40 AM", "11:40 AM - 12:30 PM", "LUNCH", "1:30 PM - 2:20 PM", "2:20 PM - 3:10 PM", "3:10 PM - 4:00 PM"];
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    const getSlotContent = (day, timeIdx) => {
        if (timeIdx === 2) return <div className="font-bold text-gray-400 rotate-90 no-print">INTERVAL</div>;
        if (timeIdx === 5) return <div className="font-bold text-gray-400 rotate-90 no-print">LUNCH</div>;
        
        let period = timeIdx + 1;
        if (timeIdx > 2) period--;
        if (timeIdx > 5) period--;

        if(!scheduleData) return null;
        
        const slots = scheduleData.schedule.filter(s => s.day === day && s.period === period);
        if(slots.length === 0) return <div className="text-gray-300">-</div>;
        
        return slots.map((slot, i) => (
            <div key={i} className="flex flex-col gap-1 p-1 bg-white rounded shadow-sm border border-orodha-purple/20 mb-1">
                <div className="bg-orodha-purple text-white text-[10px] font-bold py-0.5 px-1 rounded uppercase truncate">{slot.class_name}</div>
                <div className="text-[11px] font-bold text-gray-800 leading-tight">{slot.subject}</div>
                <div className="bg-blue-500 text-white text-[9px] py-0.5 px-1 rounded truncate">{slot.room}</div>
            </div>
        ));
    };

    return (
        <Layout title="Faculty Timetable">
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
            <div className="max-w-7xl mx-auto space-y-6">
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-end no-print">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Select Faculty</label>
                        <select 
                            className="w-full border-2 border-gray-100 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none"
                            value={selectedFaculty}
                            onChange={(e) => setSelectedFaculty(e.target.value)}
                        >
                            {facultyList.map(f => (
                                <option key={f.id} value={f.id}>{f.name} ({f.department_code})</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-1/4">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Semester Focus</label>
                        <select 
                            className="w-full border-2 border-gray-100 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none"
                            value={semesterType}
                            onChange={(e) => setSemesterType(e.target.value)}
                        >
                            <option value="ODD">ODD Semesters</option>
                            <option value="EVEN">EVEN Semesters</option>
                        </select>
                    </div>
                    <button 
                        onClick={fetchFacultyTimetable}
                        disabled={loading || !selectedFaculty}
                        className="bg-orodha-purple hover:bg-purple-700 text-white font-bold h-[52px] px-8 rounded-xl transition flex items-center gap-2"
                    >
                        <Search size={18} />
                        {loading ? 'Searching...' : 'View Schedule'}
                    </button>
                    <button onClick={() => window.print()} className="h-[52px] bg-gray-50 hover:bg-gray-100 text-gray-800 px-6 rounded-xl font-bold text-sm transition uppercase tracking-wider border border-gray-100">
                        PRINT
                    </button>
                </div>

                {scheduleData && (
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-t-[12px] border-orodha-purple">
                        <div className="mb-8 text-center">
                            <h2 className="text-2xl font-black text-gray-800 uppercase tracking-widest">
                                {scheduleData.faculty_name}
                            </h2>
                            <p className="text-gray-500 uppercase tracking-widest text-sm mt-1">
                                {semesterType} Semester Schedule
                            </p>
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
                                                <td key={idx} className={`rounded-2xl border-2 border-gray-50 overflow-hidden text-center transition-all duration-300 p-2 align-top ${idx === 2 || idx === 5 ? 'bg-gray-50/50 grayscale align-middle' : 'hover:border-orodha-purple/30 hover:shadow-lg hover:shadow-gray-100 hover:-translate-y-1 bg-gray-50/20'}`}>
                                                    {getSlotContent(day, idx)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
