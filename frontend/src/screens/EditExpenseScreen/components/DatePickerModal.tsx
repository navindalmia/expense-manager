/**
 * DatePickerModal Component
 * Calendar component for selecting expense date (past dates only, no future dates)
 * Extracted from EditExpenseScreen for reusability
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

interface DatePickerModalProps {
  visible: boolean;
  selectedDate: string; // Format: YYYY-MM-DD
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#0066cc',
    fontWeight: '600',
  },
  calendarContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  calendarButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0066cc',
    borderRadius: 4,
  },
  calendarButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  calendarWeekdays: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  calendarWeekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    paddingVertical: 6,
  },
  calendarDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginBottom: 4,
  },
  calendarDayText: {
    fontSize: 12,
    color: '#666',
  },
  calendarDayDisabled: {
    opacity: 0.4,
  },
  calendarDaySelected: {
    backgroundColor: '#0066cc',
  },
  calendarDaySelectedText: {
    color: '#fff',
    fontWeight: '600',
  },
  calendarDayToday: {
    backgroundColor: '#e6f0ff',
    borderWidth: 1,
    borderColor: '#0066cc',
  },
});

/**
 * SimpleCalendar: Calendar grid for date selection
 * Prevents future dates (expense can't be in future)
 */
function SimpleCalendar({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const [currentDate, setCurrentDate] = useState(new Date(selectedDate || new Date()));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: daysInPrevMonth - i, currentMonth: false });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, currentMonth: true });
  }

  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({ day: i, currentMonth: false });
  }

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1));
  };

  const parseDate = (dateStr: string | undefined) => {
    if (!dateStr || typeof dateStr !== 'string') {
      const today = new Date();
      return {
        year: today.getFullYear(),
        month: today.getMonth(),
        day: today.getDate(),
      };
    }

    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      console.warn(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
      const today = new Date();
      return {
        year: today.getFullYear(),
        month: today.getMonth(),
        day: today.getDate(),
      };
    }

    const [y, m, d] = parts;
    return { year: y, month: m - 1, day: d };
  };

  const selected = parseDate(selectedDate);
  const todayDate = new Date();

  const isToday = (day: number) =>
    day === todayDate.getDate() &&
    month === todayDate.getMonth() &&
    year === todayDate.getFullYear();

  const isSelected = (day: number) =>
    day === selected.day &&
    month === selected.month &&
    year === selected.year;

  const isFutureDate = (day: number) => {
    const dateToCheck = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateToCheck > today;
  };

  const handleSelectDay = (day: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return;

    const selectedDateObj = new Date(year, month, day);
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);

    if (selectedDateObj > todayObj) {
      console.log('❌ Future date not allowed:', selectedDateObj);
      return;
    }

    const yearStr = String(year).padStart(4, '0');
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${yearStr}-${monthStr}-${dayStr}`;
    console.log('📅 Day selected:', day, 'formatted date:', dateStr);
    onSelectDate(dateStr);
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity onPress={prevMonth} style={styles.calendarButton}>
          <Text style={styles.calendarButtonText}>← Prev</Text>
        </TouchableOpacity>
        <Text style={styles.calendarTitle}>
          {monthNames[month]} {year}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.calendarButton}>
          <Text style={styles.calendarButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.calendarWeekdays}>
        {weekdayNames.map(day => (
          <Text key={day} style={[styles.calendarWeekday, { textAlign: 'center' }]}>
            {day}
          </Text>
        ))}
      </View>

      <View style={styles.calendarDays}>
        {days.map((dayObj, idx) => (
          <TouchableOpacity
            key={idx}
            style={[
              styles.calendarDay,
              !dayObj.currentMonth && styles.calendarDayDisabled,
              isFutureDate(dayObj.day) && dayObj.currentMonth && styles.calendarDayDisabled,
              isToday(dayObj.day) && dayObj.currentMonth && styles.calendarDayToday,
              isSelected(dayObj.day) && dayObj.currentMonth && styles.calendarDaySelected,
            ]}
            onPress={() => handleSelectDay(dayObj.day, dayObj.currentMonth)}
            disabled={!dayObj.currentMonth || isFutureDate(dayObj.day)}
          >
            <Text
              style={[
                styles.calendarDayText,
                isSelected(dayObj.day) && dayObj.currentMonth && styles.calendarDaySelectedText,
              ]}
            >
              {dayObj.day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/**
 * DatePickerModal: Modal wrapper around calendar
 * Opens calendar in modal dialog for date selection
 */
export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  selectedDate,
  onSelectDate,
  onClose,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Date</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Done</Text>
            </TouchableOpacity>
          </View>

          <SimpleCalendar
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              onSelectDate(date);
              onClose();
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
};
