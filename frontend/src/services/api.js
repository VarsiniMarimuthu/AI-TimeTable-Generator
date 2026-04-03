import axios from 'axios';

const API_URL = "http://localhost:8000/api";

const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// --- Auth ---
export const loginUser = async (credentials) => {
    try {
        const response = await api.post("/auth/login", credentials);
        return response.data;
    } catch (error) {
        throw error;
    }
};

export const registerUser = async (userData) => {
    try {
        const response = await api.post("/auth/register", userData);
        return response.data;
    } catch (error) {
        throw error;
    }
};

// --- Admin: Departments ---
export const getDepartments = async () => {
    const response = await api.get("/admin/departments");
    return response.data;
};

export const addDepartment = async (data) => {
    const response = await api.post("/admin/departments", data);
    return response.data;
};

export const deleteDepartment = async (id) => {
    const response = await api.delete(`/admin/departments/${id}`);
    return response.data;
};

export const updateDepartment = async (id, data) => {
    const response = await api.put(`/admin/departments/${id}`, data);
    return response.data;
};

// --- Admin: Subjects ---
export const getSubjects = async (deptCode = null) => {
    const params = deptCode ? { department_code: deptCode } : {};
    const response = await api.get("/admin/subjects", { params });
    return response.data;
};

export const addSubject = async (data) => {
    const response = await api.post("/admin/subjects", data);
    return response.data;
};

export const deleteSubject = async (id) => {
    const response = await api.delete(`/admin/subjects/${id}`);
    return response.data;
};

export const updateSubject = async (id, data) => {
    const response = await api.put(`/admin/subjects/${id}`, data);
    return response.data;
};

// --- Admin: Faculty ---
export const getFaculty = async (deptCode = null) => {
    const params = deptCode ? { department_code: deptCode } : {};
    const response = await api.get("/admin/faculty", { params });
    return response.data;
};

export const addFaculty = async (data) => {
    const response = await api.post("/admin/faculty", data);
    return response.data;
};

export const deleteFaculty = async (id) => {
    const response = await api.delete(`/admin/faculty/${id}`);
    return response.data;
};

export const updateFaculty = async (id, data) => {
    const response = await api.put(`/admin/faculty/${id}`, data);
    return response.data;
};

// --- Admin: Rooms ---
export const getRooms = async () => {
    const response = await api.get("/admin/rooms");
    return response.data;
};

export const addRoom = async (data) => {
    const response = await api.post("/admin/rooms", data);
    return response.data;
};

export const updateRoom = async (id, data) => {
    const response = await api.put(`/admin/rooms/${id}`, data);
    return response.data;
};

export const deleteRoom = async (id) => {
    const response = await api.delete(`/admin/rooms/${id}`);
    return response.data;
};

// --- Faculty: Generation ---
// data = { department_code, semester, subject_allocations: [{subject_code, faculty_id}] }
export const generateTimetable = async (data) => {
    const response = await api.post("/generation/generate", data);
    return response.data;
};

export const saveTimetable = async (data) => {
    const response = await api.post("/generation/save", data);
    return response.data;
};

// --- Student: View ---
export const getTimetable = async (params) => {
    const response = await api.get("/generation/timetable", { params });
    return response.data;
};

export const getAllTimetables = async (params) => {
    const response = await api.get("/generation/all", { params });
    return response.data;
};

export const deleteTimetable = async (id) => {
    const response = await api.delete(`/generation/${id}`);
    return response.data;
};

export const customizeSlot = async (data) => {
    const response = await api.post("/generation/customize_slot", data);
    return response.data;
};

export default api;
