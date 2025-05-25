import React, { useState, useEffect, useContext, useReducer, useRef, createContext } from 'react';
import { Mic, MicOff, Plus, Download, Moon, Sun, Camera, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Theme Context
const ThemeContext = createContext();

// Expense Reducer
const expenseReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_EXPENSE':
      return [...state, { ...action.payload, id: Date.now() }];
    case 'DELETE_EXPENSE':
      return state.filter(expense => expense.id !== action.payload);
    case 'SET_EXPENSES':
      return action.payload;
    default:
      return state;
  }
};

// Custom Hooks
const useMemoryStorage = (key, initialValue) => {
  const [storedValue, setStoredValue] = useState(initialValue);
  return [storedValue, setStoredValue];
};

const useVoiceRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.log('Speech recognition not supported');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false; // Changed to false for better accuracy
    recognitionRef.current.lang = 'en-US'; // Explicitly set language

    recognitionRef.current.onresult = (event) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      console.log('Voice transcript:', transcript); // Debug log
      setTranscript(transcript);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    if (recognitionRef.current) {
      setTranscript('');
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return { isListening, transcript, startListening, stopListening };
};

// Main Component
const ExpenseTracker = () => {
  const [expenses, dispatch] = useReducer(expenseReducer, []);
  const [budget, setBudget] = useMemoryStorage('budget', 1000);
  const [darkMode, setDarkMode] = useMemoryStorage('darkMode', false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newExpense, setNewExpense] = useState({ amount: '', category: '', description: '' });
  const [debugInfo, setDebugInfo] = useState(''); // For debugging voice commands
  const { isListening, transcript, startListening, stopListening } = useVoiceRecognition();
  const fileInputRef = useRef(null);

  // Process voice command
  useEffect(() => {
    if (transcript) {
      console.log('Processing transcript:', transcript);
      const voiceExpense = parseVoiceCommand(transcript);
      console.log('Parsed expense:', voiceExpense);
      setDebugInfo(`Parsed: ${JSON.stringify(voiceExpense)}`);
      
      if (voiceExpense) {
        setNewExpense(voiceExpense);
        setShowAddForm(true);
      } else {
        setDebugInfo('Could not parse voice command. Try: "Add 50 dollars for groceries"');
      }
    }
  }, [transcript]);

  const parseVoiceCommand = (text) => {
    const lowerText = text.toLowerCase().trim();
    console.log('Parsing text:', lowerText);
    
    // Enhanced amount extraction - more flexible patterns
    const amountPatterns = [
      /(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks?|\$)/i,
      /\$\s*(\d+(?:\.\d{1,2})?)/i,
      /(\d+(?:\.\d{1,2})?)\s*(?:dollar|buck)/i,
      /spend\s*(\d+(?:\.\d{1,2})?)/i,
      /spent\s*(\d+(?:\.\d{1,2})?)/i
    ];
    
    let amount = null;
    let amountMatch = null;
    
    for (const pattern of amountPatterns) {
      amountMatch = lowerText.match(pattern);
      if (amountMatch) {
        amount = amountMatch[1];
        break;
      }
    }
    
    if (!amount) {
      console.log('No amount found');
      return null;
    }
    
    console.log('Found amount:', amount);
    
    // Enhanced category detection with synonyms and variations
    const categoryMappings = {
      'food': ['food', 'eat', 'eating', 'meal', 'lunch', 'dinner', 'breakfast', 'restaurant', 'cafe'],
      'groceries': ['groceries', 'grocery', 'supermarket', 'market', 'shopping for food', 'food shopping'],
      'transport': ['transport', 'transportation', 'travel', 'bus', 'taxi', 'uber', 'lyft', 'gas', 'fuel', 'petrol', 'car'],
      'entertainment': ['entertainment', 'movie', 'cinema', 'game', 'gaming', 'fun', 'party', 'concert', 'show'],
      'shopping': ['shopping', 'clothes', 'clothing', 'shoes', 'accessories', 'online shopping'],
      'bills': ['bill', 'bills', 'electricity', 'water', 'internet', 'phone', 'rent', 'utilities'],
      'health': ['health', 'medical', 'doctor', 'medicine', 'pharmacy', 'hospital', 'dentist'],
      'other': ['other', 'miscellaneous', 'misc']
    };
    
    let category = 'Other';
    let foundCategory = false;
    
    // Check each category and its synonyms
    for (const [cat, synonyms] of Object.entries(categoryMappings)) {
      for (const synonym of synonyms) {
        if (lowerText.includes(synonym)) {
          category = cat.charAt(0).toUpperCase() + cat.slice(1);
          foundCategory = true;
          console.log(`Found category: ${category} (matched: ${synonym})`);
          break;
        }
      }
      if (foundCategory) break;
    }
    
    // Enhanced description extraction
    let description = text;
    
    // Remove amount mentions
    if (amountMatch) {
      description = description.replace(amountMatch[0], '');
    }
    
    // Remove common command words
    const removeWords = ['add', 'spent', 'spend', 'for', 'on', 'buying', 'bought', 'purchase', 'purchased'];
    removeWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      description = description.replace(regex, '');
    });
    
    description = description.trim();
    
    // If description is empty or too short, use category
    if (!description || description.length < 2) {
      description = category;
    }
    
    const result = { 
      amount: amount, 
      category: category, 
      description: description 
    };
    
    console.log('Final parsed result:', result);
    return result;
  };

  const addExpense = () => {
    if (!newExpense.amount || !newExpense.category) return;
    
    const expense = {
      ...newExpense,
      amount: parseFloat(newExpense.amount),
      date: new Date().toISOString().split('T')[0]
    };
    
    dispatch({ type: 'ADD_EXPENSE', payload: expense });
    setNewExpense({ amount: '', category: '', description: '' });
    setShowAddForm(false);
    setDebugInfo(''); // Clear debug info after successful add
  };

  const deleteExpense = (id) => {
    dispatch({ type: 'DELETE_EXPENSE', payload: id });
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remainingBudget = budget - totalExpenses;
  const budgetPercentage = (totalExpenses / budget) * 100;

  // Chart data
  const categoryData = expenses.reduce((acc, expense) => {
    const existing = acc.find(item => item.name === expense.category);
    if (existing) {
      existing.value += expense.amount;
    } else {
      acc.push({ name: expense.category, value: expense.amount });
    }
    return acc;
  }, []);

  const monthlyData = expenses.reduce((acc, expense) => {
    const month = new Date(expense.date).toLocaleDateString('en-US', { month: 'short' });
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.amount += expense.amount;
    } else {
      acc.push({ month, amount: expense.amount });
    }
    return acc;
  }, []);

  const handleImageCapture = (event) => {
    const file = event.target.files[0];
    if (file) {
      alert('Receipt captured! In a real app, this would extract expense data using OCR.');
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <ThemeContext.Provider value={{ darkMode, setDarkMode }}>
      <div className={`min-h-screen transition-all duration-300 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
        <div className="container mx-auto p-4 max-w-6xl">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <DollarSign className="text-green-500" />
              Smart Expense Tracker
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-100'} shadow-md`}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          {/* Budget Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="text-lg font-semibold mb-2">Total Spent</h3>
              <p className="text-3xl font-bold text-red-500">${totalExpenses.toFixed(2)}</p>
            </div>
            <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="text-lg font-semibold mb-2">Budget</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className={`text-2xl font-bold bg-transparent border-b ${darkMode ? 'border-gray-600' : 'border-gray-300'} focus:outline-none`}
                />
              </div>
            </div>
            <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="text-lg font-semibold mb-2">Remaining</h3>
              <p className={`text-3xl font-bold ${remainingBudget >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                ${remainingBudget.toFixed(2)}
              </p>
              {budgetPercentage > 80 && (
                <div className="flex items-center gap-1 mt-2 text-orange-500">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Budget Alert!</span>
                </div>
              )}
            </div>
          </div>

          {/* Budget Progress Bar */}
          <div className={`p-4 rounded-xl shadow-lg mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="text-lg font-semibold mb-3">Budget Progress</h3>
            <div className={`w-full bg-gray-200 rounded-full h-3 ${darkMode ? 'bg-gray-700' : ''}`}>
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  budgetPercentage > 100 ? 'bg-red-500' : budgetPercentage > 80 ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
              ></div>
            </div>
            <p className="text-sm mt-2">{budgetPercentage.toFixed(1)}% of budget used</p>
          </div>

          {/* Voice Command Instructions */}
          <div className={`p-4 rounded-xl shadow-lg mb-6 ${darkMode ? 'bg-blue-900' : 'bg-blue-50'} border border-blue-200`}>
            <h3 className="text-lg font-semibold mb-2 text-blue-700">💡 Voice Command Examples:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <p>• "Add 50 dollars for groceries"</p>
              <p>• "Spent 25 on transport"</p>
              <p>• "Add 15 dollars for lunch food"</p>
              <p>• "Bought entertainment tickets for 30 dollars"</p>
              <p>• "Add 100 for shopping clothes"</p>
              <p>• "Spent 75 dollars on bills electricity"</p>
            </div>
          </div>

          {/* Voice Command & Add Expense */}
          <div className={`p-6 rounded-xl shadow-lg mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex gap-4">
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    isListening 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  {isListening ? 'Stop Listening' : 'Voice Command'}
                </button>
                
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-2 px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Add Expense
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  Scan Receipt
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageCapture}
                  className="hidden"
                />
              </div>
            </div>

            {transcript && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800">Voice Command: "{transcript}"</p>
                {debugInfo && (
                  <p className="text-sm text-gray-600 mt-1">{debugInfo}</p>
                )}
              </div>
            )}
          </div>

          {/* Add Expense Form */}
          {showAddForm && (
            <div className={`p-6 rounded-xl shadow-lg mb-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="text-xl font-semibold mb-4">Add New Expense</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  type="number"
                  placeholder="Amount"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  className={`p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  }`}
                />
                <select
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                  className={`p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  }`}
                >
                  <option value="">Select Category</option>
                  <option value="Food">Food</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Transport">Transport</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Bills">Bills</option>
                  <option value="Health">Health</option>
                  <option value="Other">Other</option>
                </select>
                <input
                  type="text"
                  placeholder="Description"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  className={`p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    darkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                  }`}
                />
              </div>
              <button
                onClick={addExpense}
                className="mt-4 px-6 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
              >
                Add Expense
              </button>
            </div>
          )}

          {/* Charts */}
          {expenses.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className="text-xl font-semibold mb-4">Expenses by Category</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
                <h3 className="text-xl font-semibeld mb-4">Monthly Spending</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="amount" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Recent Expenses */}
          <div className={`p-6 rounded-xl shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h3 className="text-xl font-semibold mb-4">Recent Expenses</h3>
            {expenses.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No expenses added yet. Try adding one with voice commands!</p>
            ) : (
              <div className="space-y-3">
                {expenses.slice(-10).reverse().map((expense) => (
                  <div key={expense.id} className={`flex justify-between items-center p-4 rounded-lg border ${
                    darkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div>
                      <h4 className="font-semibold">{expense.description}</h4>
                      <p className="text-sm text-gray-500">{expense.category} • {expense.date}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg">${expense.amount}</span>
                      <button
                        onClick={() => deleteExpense(expense.id)}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
};

export default ExpenseTracker;