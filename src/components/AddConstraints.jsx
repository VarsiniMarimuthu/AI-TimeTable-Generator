import React, { useState, useEffect } from "react";
import {
  Typography,
  Stack,
  Chip,
  Container,
  Paper,
  Grid,
  TextField,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Autocomplete,
  CircularProgress,
  Button,
} from "@mui/material";
import { LocalizationProvider, TimePicker } from "@mui/lab";
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import { AddCircleOutlined } from "@mui/icons-material";
import Swal from "sweetalert2";
import axios from "axios";

const AddConstraints = () => {
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState([]);

  const [days, setDays] = useState({
    Monday: false,
    Tuesday: false,
    Wednesday: false,
    Thursday: false,
    Friday: false,
    Saturday: false,
    Sunday: false,
  });

  const [times, setTimes] = useState(
    Object.fromEntries(
      Object.keys(days).map((d) => [d, { start: new Date(), end: new Date() }])
    )
  );

  const [checkedA, setCheckedA] = useState(false);
  const [nsub1, setnSub1] = useState(null);
  const [nsub2, setnSub2] = useState(null);

  useEffect(() => {
    axios.get("http://localhost:8000/get-courses").then((res) => {
      const unique = Array.from(
        new Map(res.data.map((c) => [c.name, { label: c.name, value: c.name }])).values()
      );
      setSubjects(unique);
      setLoading(false);
    });
  }, []);

  const handleSubmit = () => {
    let working_days = [];

    for (const day of Object.keys(days)) {
      if (days[day]) {
        const start = times[day].start.getHours();
        const end = times[day].end.getHours();

        if (end - start < 2) {
          Swal.fire({
            icon: "error",
            title: "Invalid Time",
            text: `${day}: Minimum 2 hours required`,
          });
          return;
        }

        working_days.push({
          day,
          start_hr: start,
          end_hr: end,
          total_hours: end - start,
        });
      }
    }

    if (working_days.length === 0) {
      Swal.fire("Warning", "Select at least one working day", "warning");
      return;
    }

    const body = {
      working_days,
      non_consecutive_subjects: checkedA
        ? nsub1 && nsub2
          ? [[nsub1.value, nsub2.value]]
          : []
        : [],
    };

    axios
      .post("http://localhost:8000/add-constraints", body)
      .then(() => {
        Swal.fire("Success", "Constraints added successfully!", "success");
      })
      .catch((err) => {
        console.error(err);
        Swal.fire("Error", "Failed to add constraints", "error");
      });
  };

  if (loading) return <CircularProgress />;

  return (
    <Container maxWidth="md">
      <Paper sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6" align="center">
          Time Table Constraints
        </Typography>

        <Stack direction="row" spacing={1} justifyContent="center" mt={2}>
          {Object.keys(days).map((day) => (
            <Chip
              key={day}
              label={day}
              color="primary"
              variant={days[day] ? "filled" : "outlined"}
              onClick={() => {
                const isSelected = !days[day];
                setDays({ ...days, [day]: isSelected });

                // ✅ AUTO-FIX DEFAULT TIME ONLY WHEN SELECTED
                if (isSelected) {
                  const start = new Date();
                  const end = new Date(start);
                  end.setHours(start.getHours() + 2);

                  setTimes((prev) => ({
                    ...prev,
                    [day]: { start, end },
                  }));
                }
              }}

            />
          ))}
        </Stack>

        <Grid container spacing={2} mt={2}>
          {Object.keys(days).map(
            (day) =>
              days[day] && (
                <React.Fragment key={day}>
                  <Grid item xs={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <TimePicker
                        label={`${day} Start`}
                        value={times[day].start}
                        onChange={(v) =>
                          setTimes({ ...times, [day]: { ...times[day], start: v } })
                        }
                        renderInput={(p) => <TextField {...p} />}
                      />
                    </LocalizationProvider>
                  </Grid>
                  <Grid item xs={6}>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <TimePicker
                        label={`${day} End`}
                        value={times[day].end}
                        onChange={(v) =>
                          setTimes({ ...times, [day]: { ...times[day], end: v } })
                        }
                        renderInput={(p) => <TextField {...p} />}
                      />
                    </LocalizationProvider>
                  </Grid>
                </React.Fragment>
              )
          )}
        </Grid>

        <FormGroup sx={{ mt: 3 }}>
          <FormControlLabel
            control={<Checkbox checked={checkedA} onChange={() => setCheckedA(!checkedA)} />}
            label="Two subjects which cannot be consecutive"
          />
        </FormGroup>

        {checkedA && (
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Autocomplete
                options={subjects}
                value={nsub1}
                onChange={(e, v) => setnSub1(v)}
                getOptionLabel={(o) => o.label}
                renderInput={(p) => <TextField {...p} label="Subject 1" />}
              />
            </Grid>
            <Grid item xs={6}>
              <Autocomplete
                options={subjects}
                value={nsub2}
                onChange={(e, v) => {
                  if (v?.value === nsub1?.value) {
                    Swal.fire("Warning", "Same subject not allowed", "warning");
                    return;
                  }
                  setnSub2(v);
                }}
                getOptionLabel={(o) => o.label}
                renderInput={(p) => <TextField {...p} label="Subject 2" />}
              />
            </Grid>
          </Grid>
        )}

        <Button
          fullWidth
          sx={{ mt: 3 }}
          variant="outlined"
          startIcon={<AddCircleOutlined />}
          onClick={handleSubmit}
        >
          Add Constraints
        </Button>
      </Paper>
    </Container>
  );
};

export default AddConstraints;
