import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

export default function CustomizeModal({ isOpen, onClose, selectedSlot, onSave }) {
    if (!isOpen || !selectedSlot) return null;

    const { department_code, year, class_name, semester, schedule } = selectedSlot.timetableInfo;

    const [day, setDay] = useState('Monday');
    const [period, setPeriod] = useState(1);

    const [faculties, setFaculties] = useState([]);
    const [substituteId, setSubstituteId] = useState('');
    const [daysToReplace, setDaysToReplace] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchFaculties = async () => {
            try {
                // Fetch faculties from the same department as default
                const res = await api.getFaculty(department_code);
                setFaculties(res || []);
            } catch (error) {
                console.error("Failed to load faculty:", error);
            }
        };
        fetchFaculties();
    }, [department_code]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        if (!substituteId || !daysToReplace || daysToReplace <= 0) {
            setError("Please fill all fields properly");
            return;
        }

        setLoading(true);
        try {
            await api.customizeSlot({
                department_code,
                year,
                class_name,
                day,
                period,
                new_faculty_id: substituteId,
                number_of_days: daysToReplace
            });
            onSave();
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to customize slot.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">
                <div className="bg-orodha-purple px-8 py-5 text-white">
                    <h2 className="text-xl font-bold uppercase tracking-wider">Customize Slot</h2>
                </div>

                <form onSubmit={handleSubmit} className="p-8">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm font-bold rounded-lg border border-red-200 uppercase tracking-tighter">
                            {error}
                        </div>
                    )}
                    
                    <div className="mb-4 bg-gray-50 p-4 rounded-xl border-2 border-gray-100 flex justify-between items-center">
                        <div>
                            <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Target Timetable</div>
                            <div className="text-sm font-bold text-gray-700 uppercase tracking-tight">{department_code} • Year {year} • Class {class_name} • Sem {semester}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Current Subject</div>
                            <div className="text-sm font-black text-orodha-purple uppercase tracking-tight">
                                {schedule?.find(s => s.day === day && s.period === period)?.subject || 'Free Slot / Lunch'}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Day</label>
                                <select 
                                    className="w-full border-2 border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition uppercase text-sm font-bold"
                                    value={day}
                                    onChange={e => setDay(e.target.value)}
                                >
                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Period</label>
                                <select 
                                    className="w-full border-2 border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition uppercase text-sm font-bold"
                                    value={period}
                                    onChange={e => setPeriod(parseInt(e.target.value))}
                                >
                                    {[1, 2, 3, 4, 5, 6, 7].map(p => <option key={p} value={p}>Period {p}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Substitute Faculty</label>
                            <select
                                className="w-full border-2 border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition uppercase text-sm font-bold"
                                value={substituteId}
                                onChange={e => setSubstituteId(e.target.value)}
                                required
                            >
                                <option value="">-- Select Substitute --</option>
                                {faculties.map(f => (
                                    <option key={f.id} value={f.id}>{f.name} ({f.designation})</option>
                                ))}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wider">Number of Days Valid</label>
                            <input
                                type="number"
                                min="1"
                                max="365"
                                className="w-full border-2 border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-orodha-purple outline-none transition font-black text-gray-700"
                                value={daysToReplace}
                                onChange={e => setDaysToReplace(parseInt(e.target.value))}
                                required
                            />
                            <p className="text-xs font-bold text-gray-400 mt-2">After this duration, the slot auto-returns to the original faculty.</p>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-6 py-3 border-2 border-gray-200 text-gray-500 font-black rounded-xl hover:bg-gray-50 transition uppercase tracking-wider text-sm">
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="px-6 py-3 bg-orodha-pink text-white font-black rounded-xl shadow-lg hover:bg-pink-600 transition disabled:opacity-50 disabled:scale-100 uppercase tracking-wider text-sm"
                        >
                            {loading ? 'Saving...' : 'Confirm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
