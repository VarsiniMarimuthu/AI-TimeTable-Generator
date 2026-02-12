import { Edit, Trash2, RefreshCw, Copy } from 'lucide-react';

export function DataTable({ headers, data, onEdit, onDelete, onDuplicate, showActions = true }) {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
            <table className="w-full">
                <thead className="bg-orodha-blue text-white">
                    <tr>
                        {headers.map((h, i) => (
                            <th key={i} className="p-3 text-left text-sm font-semibold first:rounded-tl-lg last:rounded-tr-lg">{h}</th>
                        ))}
                        {showActions && <th className="p-3">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {data.map((row, idx) => (
                        <tr key={idx} className={`hover:bg-blue-50 transition ${idx % 2 === 0 ? 'bg-blue-50/30' : 'bg-white'}`}>
                            {headers.map((h, i) => {
                                const key = h.toLowerCase().replace(/ /g, '_').replace('.', '');
                                return <td key={i} className="p-3 text-sm text-gray-700">{row[key] || row[Object.keys(row)[i]]}</td>
                            })}
                            {showActions && (
                                <td className="p-3 flex gap-2 justify-center">
                                    {onDuplicate && <button onClick={() => onDuplicate(row)} className="p-1.5 text-green-600 hover:bg-green-100 rounded" title="Duplicate"><Copy size={16} /></button>}
                                    <button onClick={() => onEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded" title="Edit"><Edit size={16} /></button>
                                    <button onClick={() => onDelete(row)} className="p-1.5 text-red-600 hover:bg-red-100 rounded" title="Delete"><Trash2 size={16} /></button>
                                </td>
                            )}
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr><td colSpan={headers.length + (showActions ? 1 : 0)} className="p-8 text-center text-gray-400">No records found</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

export function ActionButtons({ onAdd, onUpdate, onDelete }) {
    return (
        <div className="flex gap-2 mt-6">
            <button onClick={onAdd} className="flex-1 bg-orodha-blue text-white py-2 rounded font-semibold hover:bg-blue-700 transition shadow">ADD</button>
            <button onClick={onUpdate} className="bg-orodha-blue text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition shadow">UPDATE</button>
            <button onClick={onDelete} className="bg-orodha-blue text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 transition shadow">DELETE</button>
        </div>
    )
}
