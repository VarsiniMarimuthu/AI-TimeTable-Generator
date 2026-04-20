import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Departments from './pages/Departments';
import Subjects from './pages/Subjects';
import Faculty from './pages/Faculty';
import Generator from './pages/Generator';
import Rooms from './pages/Rooms';
import Timetables from './pages/Timetables';
import FacultyTimetableView from './pages/FacultyTimetableView';
import AllTimetables from './pages/AllTimetables';

function App() {
  return (
    <BrowserRouter>
      <div className="bg-gray-100 min-h-screen text-gray-800 font-sans">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/faculty" element={<Faculty />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/generate" element={<Generator />} />
          <Route path="/timetables" element={<Timetables />} />
          <Route path="/all-timetables" element={<AllTimetables />} />
          <Route path="/faculty-timetable" element={<FacultyTimetableView />} />

          {/* Formatting Redirects */}
          <Route path="/admin" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
