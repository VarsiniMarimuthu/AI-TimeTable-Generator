import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import * as api from '../services/api';
import CustomizeModal from '../components/CustomizeModal';

export default function AllTimetables() {
    const [timetables, setTimetables] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null); 
    // Format for selectedSlot: { timetableInfo, slotInfo }

    const fetchAllTimetables = async () => {
        setLoading(true);
        try {
            const res = await api.getAllTimetables();
            // Sort by Year and then by Class
            const sorted = res.sort((a, b) => {
                if (a.year !== b.year) return a.year - b.year;
                return a.class_name.localeCompare(b.class_name);
            });
            setTimetables(sorted || []);
        } catch (err) {
            console.error(err);
            setError("Failed to load timetables.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllTimetables();
    }, []);

    const handleCustomizeClick = (timetable) => {
        setSelectedSlot({
            timetableInfo: {
                department_code: timetable.department_code,
                year: timetable.year,
                class_name: timetable.class_name,
                semester: timetable.semester,
                schedule: timetable.schedule // Pass schedule to modal for subject validation
            }
        });
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to delete this timetable forever?")) {
            try {
                await api.deleteTimetable(id);
                fetchAllTimetables();
            } catch (err) {
                alert("Failed to delete the timetable.");
                console.error(err);
            }
        }
    };

    const handleModalClose = () => {
        setSelectedSlot(null);
    };

    const handleModalSave = () => {
        setSelectedSlot(null);
        // Refresh exactly after save to ensure substitute displays
        fetchAllTimetables();
    };

    return (
        <Layout title="All Timetables">
            {loading && <div className="text-center py-10 text-gray-500 font-bold uppercase tracking-wider">Loading timetables...</div>}
            
            {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center font-bold uppercase">{error}</div>}

            {!loading && !error && timetables.length === 0 && (
                <div className="text-center py-10 bg-white shadow-xl rounded-2xl flex flex-col items-center justify-center p-10 border-2 border-dashed border-gray-200">
                    <span className="text-4xl mb-4">📭</span>
                    <h3 className="text-gray-400 font-bold uppercase tracking-widest">No Timetables Found</h3>
                </div>
            )}

            {!loading && !error && timetables.map((tt) => (
                <div key={tt.id} className="bg-white p-8 rounded-2xl shadow-xl border-t-8 border-orodha-purple mb-10 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform duration-500"></div>
                    
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <div className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">{tt.department_code} • SEMESTER {tt.semester}</div>
                            <h2 className="text-3xl font-black text-orodha-purple uppercase tracking-tighter">
                                Year {tt.year} <span className="text-pink-500">•</span> Class {tt.class_name}
                            </h2>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => handleCustomizeClick(tt)}
                                className="px-5 py-2 bg-orodha-pink text-white font-black rounded-xl shadow-lg hover:bg-pink-600 transition tracking-wider text-xs uppercase"
                            >
                                Substitute / Edit
                            </button>
                            <button 
                                onClick={() => handleDelete(tt.id)}
                                className="px-5 py-2 border-2 border-red-100 text-red-500 font-black rounded-xl hover:bg-red-50 transition tracking-wider text-xs uppercase"
                            >
                                Delete
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-xl border-2 border-gray-100 mb-2">
                        <table className="w-full table-fixed border-separate border-spacing-0">
                            <thead>
                                <tr>
                                    <th className="w-24 bg-gray-50/80 border-b-2 border-r-2 border-gray-100 p-4 text-[11px] font-black text-gray-400 uppercase tracking-widest text-left">Day / Period</th>
                                    {[1, 2, 'INTERVAL', 3, 4, 'LUNCH', 5, 6, 7].map((item, idx) => (
                                        <th key={idx} className={`border-b-2 border-gray-100 p-3 text-[10px] font-black uppercase text-center transition-all ${item === 'INTERVAL' || item === 'LUNCH' ? 'bg-gray-100 text-gray-400 w-12 border-x-2' : 'bg-white text-gray-500 hover:text-orodha-purple hover:bg-purple-50'}`}>
                                            {item === 'INTERVAL' || item === 'LUNCH' ? 
                                                <div className="writing-vertical-rl transform rotate-180 text-[9px] mx-auto tracking-widest">{item}</div> : 
                                                <div className="text-lg text-gray-800">{item}</div>
                                            }
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                                    <tr key={day} className="h-28 group/row relative">
                                        <td className="bg-gray-50/80 border-b-2 border-r-2 border-gray-100 p-3 text-[12px] font-black text-orodha-purple uppercase tracking-tighter">
                                            {day.slice(0, 3)}
                                        </td>
                                        {[1, 2, 'INTERVAL', 3, 4, 'LUNCH', 5, 6, 7].map((item, idx) => {
                                            if (item === 'INTERVAL' || item === 'LUNCH') {
                                                return <td key={idx} className="border-b-2 border-x-2 border-gray-100 bg-gray-100/50"></td>;
                                            }
                                            
                                            const period = item;
                                            const slot = tt.schedule.find(s => s.day === day && s.period === period);
                                            
                                            return (
                                                <td key={idx} className="border-b-2 border-gray-100 p-1 bg-white hover:bg-purple-50/50 transition relative group/cell">
                                                    {slot ? (
                                                        <div className="h-full flex flex-col justify-center p-2 rounded-xl transition border border-transparent hover:border-orodha-purple/30 group-hover/cell:shadow-md relative bg-white">
                                                            {slot.substitute_valid_until && (
                                                                <div className="absolute -top-2 -right-2 bg-pink-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shadow-sm border border-white z-10 animate-pulse">SUB</div>
                                                            )}
                                                            <div className={`text-[10px] font-black py-0.5 px-1 rounded uppercase tracking-tighter truncate w-max mx-auto mb-1 ${slot.substitute_valid_until ? 'bg-pink-100 text-pink-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                {slot.faculty.split(',')[0]}
                                                            </div>
                                                            <div className="text-[11px] font-black text-gray-800 leading-tight text-center mb-1 truncate px-1">{slot.acronym || slot.subject_code || slot.subject}</div>
                                                            <div className="bg-gray-100 text-gray-500 text-[9px] py-0.5 px-1.5 rounded-full mx-auto w-max font-bold">{slot.room}</div>
                                                        </div>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center">
                                                            <span className="w-2 h-2 rounded-full bg-gray-200"></span>
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            <CustomizeModal 
                isOpen={!!selectedSlot} 
                onClose={handleModalClose} 
                selectedSlot={selectedSlot}
                onSave={handleModalSave}
            />
        </Layout>
    );
}
