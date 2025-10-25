import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Dimensions,
  PanResponder
} from 'react-native';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterSettings) => void;
  initialFilters?: FilterSettings;
}

export interface FilterSettings {
  gender: 'all' | 'male' | 'female';
  ratingMin: number;
  ratingMax: number;
  levelMin: number; // Index in levels array (0-5 for A1-C2)
  levelMax: number; // Index in levels array (0-5 for A1-C2)
  levels: string[];
}

const FilterModal = ({ visible, onClose, onApply, initialFilters }: FilterModalProps) => {
  const [gender, setGender] = useState<'all' | 'male' | 'female'>(
    initialFilters?.gender || 'all'
  );
  const [ratingMin, setRatingMin] = useState(initialFilters?.ratingMin || 0);
  const [ratingMax, setRatingMax] = useState(initialFilters?.ratingMax || 100);
  const [levelMin, setLevelMin] = useState(initialFilters?.levelMin || 0);
  const [levelMax, setLevelMax] = useState(initialFilters?.levelMax || 5);

  const englishLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  
  // Get selected levels based on range
  const selectedLevels = englishLevels.slice(levelMin, levelMax + 1);

  const getLevelHeight = (index: number) => {
    // Create different heights for visual effect
    const heights: { [key: number]: number } = {
      0: 20,   // A1
      1: 25,   // A2
      2: 50,   // B1
      3: 70,   // B2
      4: 60,   // C1
      5: 40,   // C2
    };
    return heights[index] || 30;
  };

  const getLevelColor = (index: number) => {
    // Check if this level is within the selected range
    if (index >= levelMin && index <= levelMax) {
      return '#673AB7'; // Purple
    }
    return '#E0E0E0'; // Light gray for unselected
  };

  const handleRatingMinChange = (value: number) => {
    console.log('handleRatingMinChange called with:', value, 'current:', ratingMin);
    const newMin = Math.max(0, Math.min(value, ratingMax - 1));
    console.log('Setting ratingMin to:', newMin);
    setRatingMin(newMin);
    console.log('ratingMin state after set:', ratingMin);
  };

  const handleRatingMaxChange = (value: number) => {
    console.log('handleRatingMaxChange called with:', value, 'current:', ratingMax);
    const newMax = Math.max(ratingMin + 1, Math.min(value, 100));
    console.log('Setting ratingMax to:', newMax);
    setRatingMax(newMax);
    console.log('ratingMax state after set:', ratingMax);
  };

  const handleLevelMinChange = (index: number) => {
    setLevelMin(Math.max(0, Math.min(index, levelMax)));
  };

  const handleLevelMaxChange = (index: number) => {
    setLevelMax(Math.max(levelMin, Math.min(index, englishLevels.length - 1)));
  };

  const handleApply = () => {
    onApply({
      gender,
      ratingMin,
      ratingMax,
      levelMin,
      levelMax,
      levels: selectedLevels
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.modal}>
              <View style={styles.header}>
                <Text style={styles.title}>Find a partner</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Gender Filter */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Gender</Text>
                  <View style={styles.pillContainer}>
                    <TouchableOpacity
                      style={[styles.pill, gender === 'all' && styles.pillActive]}
                      onPress={() => setGender('all')}
                    >
                      <Text style={[styles.pillText, gender === 'all' && styles.pillTextActive]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pill, gender === 'male' && styles.pillActive]}
                      onPress={() => setGender('male')}
                    >
                      <Text style={[styles.pillText, gender === 'male' && styles.pillTextActive]}>
                        Male
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pill, gender === 'female' && styles.pillActive]}
                      onPress={() => setGender('female')}
                    >
                      <Text style={[styles.pillText, gender === 'female' && styles.pillTextActive]}>
                        Female
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Rating Filter */}
                <View style={styles.section}>
                  <View style={styles.ratingHeader}>
                    <Text style={styles.sectionTitle}>Rating</Text>
                    <Text style={styles.ratingRange}>
                      {ratingMin}-{ratingMax}% 👍
                    </Text>
                  </View>
                  
                  {/* Rating Slider with Buttons */}
                  <View style={styles.sliderContainer}>
                    <View style={styles.sliderTrack}>
                      <View style={[styles.sliderActiveTrack, { 
                        left: `${ratingMin}%`, 
                        width: `${ratingMax - ratingMin}%` 
                      }]} />
                      <TouchableOpacity
                        style={[styles.sliderThumb, { left: `${ratingMin}%` }]}
                        onPress={() => {
                          const newValue = ratingMin > 0 ? ratingMin - 10 : 0;
                          console.log('Min thumb pressed, new value:', newValue);
                          handleRatingMinChange(newValue);
                        }}
                      />
                      <TouchableOpacity
                        style={[styles.sliderThumb, { left: `${ratingMax}%` }]}
                        onPress={() => {
                          const newValue = ratingMax < 100 ? ratingMax + 10 : 100;
                          console.log('Max thumb pressed, new value:', newValue);
                          handleRatingMaxChange(newValue);
                        }}
                      />
                    </View>
                    <View style={styles.sliderButtonsRow}>
                      <TouchableOpacity 
                        style={styles.sliderButton}
                        onPress={() => {
                          console.log('Min button pressed, current:', ratingMin);
                          handleRatingMinChange(Math.max(0, ratingMin - 10));
                        }}
                      >
                        <Text style={styles.sliderButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.sliderLabel}>Range: {ratingMin}-{ratingMax}%</Text>
                      <TouchableOpacity 
                        style={styles.sliderButton}
                        onPress={() => {
                          console.log('Max button pressed, current:', ratingMax);
                          handleRatingMaxChange(Math.min(100, ratingMax + 10));
                        }}
                      >
                        <Text style={styles.sliderButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* English Level Filter */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>English level</Text>
                  
                  {/* English Level Bars - Clickable */}
                  <View style={styles.levelContainer}>
                    {englishLevels.map((level, index) => (
                      <TouchableOpacity
                        key={level}
                        style={styles.levelColumn}
                        onPress={() => {
                          // Toggle this level by adjusting range
                          if (index < levelMin) {
                            handleLevelMinChange(index);
                          } else if (index > levelMax) {
                            handleLevelMaxChange(index);
                          } else {
                            // If clicking within range, toggle the edge
                            const distanceFromMin = Math.abs(index - levelMin);
                            const distanceFromMax = Math.abs(index - levelMax);
                            if (distanceFromMin < distanceFromMax) {
                              handleLevelMinChange(index + 1);
                            } else {
                              handleLevelMaxChange(index - 1);
                            }
                          }
                        }}
                      >
                        <View
                          style={[
                            styles.levelBar,
                            {
                              height: getLevelHeight(index),
                              backgroundColor: getLevelColor(index)
                            }
                          ]}
                        />
                        <Text style={styles.levelLabel}>{level}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  {/* Level Range Slider with Buttons */}
                  <View style={styles.sliderContainer}>
                    <View style={styles.sliderTrack}>
                      <View style={[styles.sliderActiveTrack, { 
                        left: `${(levelMin / 5) * 100}%`, 
                        width: `${((levelMax - levelMin) / 5) * 100}%` 
                      }]} />
                    </View>
                    <View style={styles.sliderButtonsRow}>
                      <TouchableOpacity 
                        style={styles.sliderButton}
                        onPress={() => {
                          const newMin = Math.max(0, levelMin - 1);
                          handleLevelMinChange(newMin);
                        }}
                      >
                        <Text style={styles.sliderButtonText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.sliderLabel}>
                        {englishLevels[levelMin]} to {englishLevels[levelMax]}
                      </Text>
                      <TouchableOpacity 
                        style={styles.sliderButton}
                        onPress={() => {
                          const newMax = Math.min(englishLevels.length - 1, levelMax + 1);
                          handleLevelMaxChange(newMax);
                        }}
                      >
                        <Text style={styles.sliderButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Apply Button */}
              <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                <Text style={styles.applyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#999',
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pillContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pillActive: {
    backgroundColor: '#673AB7',
    borderColor: '#673AB7',
  },
  pillText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  pillTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingRange: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  ratingInfo: {
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  ratingInfoText: {
    fontSize: 14,
    color: '#666',
  },
  levelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 100,
    marginTop: 20,
  },
  levelColumn: {
    alignItems: 'center',
  },
  levelBar: {
    width: 24,
    borderRadius: 4,
    marginBottom: 8,
  },
  levelLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  sliderContainer: {
    marginTop: 20,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    position: 'relative',
  },
  sliderActiveTrack: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#673AB7',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#673AB7',
    borderWidth: 3,
    borderColor: 'white',
    top: -6,
    marginLeft: -10,
  },
  sliderButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  sliderButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#673AB7',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sliderButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sliderLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  applyButton: {
    margin: 20,
    marginTop: 10,
    backgroundColor: '#673AB7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FilterModal;
