"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "../../../context/AuthContext";
import { collection, getDocs, doc, updateDoc, addDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Plus, Minus, Trash2, Package, AlertTriangle, PlusCircle, UploadCloud, DollarSign } from "lucide-react";
import Papa from "papaparse";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stockCount: number;
  unit: string;
  threshold: number;
  unitCost: number;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "Food",
    stockCount: 0,
    unit: "units",
    threshold: 5,
    unitCost: 0 
  });

  const fetchInventory = async () => {
    if (!user?.restaurantId) return;
    try {
      const invRef = collection(db, "restaurants", user.restaurantId, "inventory");
      const snapshot = await getDocs(invRef);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<InventoryItem, 'id'>)
      }));
      items.sort((a, b) => a.name.localeCompare(b.name));
      setInventory(items);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [user?.restaurantId]);

  const handleAdjustStock = async (id: string, currentStock: number, change: number) => {
    if (!user?.restaurantId) return;
    const newStock = Math.max(0, currentStock + change);
    try {
      const itemRef = doc(db, "restaurants", user.restaurantId, "inventory", id);
      await updateDoc(itemRef, { stockCount: newStock });
      setInventory(inventory.map(item => item.id === id ? { ...item, stockCount: newStock } : item));
    } catch (error) {
      console.error("Error updating stock:", error);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.restaurantId) return;
    try {
      const invRef = collection(db, "restaurants", user.restaurantId, "inventory");
      const docRef = await addDoc(invRef, newItem);
      setInventory([...inventory, { id: docRef.id, ...newItem }].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddForm(false);
      setNewItem({ name: "", category: "Food", stockCount: 0, unit: "units", threshold: 5, unitCost: 0 });
    } catch (error) {
      console.error("Error adding item:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.restaurantId) return;
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      const itemRef = doc(db, "restaurants", user.restaurantId, "inventory", id);
      await deleteDoc(itemRef);
      setInventory(inventory.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const handleClearInventory = async () => {
    if (!user?.restaurantId) return;
    if (inventory.length === 0) {
      alert("Inventory is already empty.");
      return;
    }

    const confirmed = window.confirm(
      "🛑 WARNING: Are you absolutely sure you want to clear your ENTIRE inventory? This will delete all items and cannot be undone."
    );

    if (!confirmed) return;

    setIsClearing(true);
    try {
      const batch = writeBatch(db);
      
      inventory.forEach((item) => {
        const itemRef = doc(db, "restaurants", user.restaurantId, "inventory", item.id);
        batch.delete(itemRef);
      });

      await batch.commit(); 
      setInventory([]);
      alert("Inventory has been completely cleared.");
    } catch (error) {
      console.error("Error clearing inventory:", error);
      alert("Failed to clear inventory.");
    } finally {
      setIsClearing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.restaurantId) return;

    setIsImporting(true);

    Papa.parse(file, {
      header: true, 
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const batch = writeBatch(db);
          const invRef = collection(db, "restaurants", user.restaurantId, "inventory");

          results.data.forEach((row: any) => {
            const newDocRef = doc(invRef); 
            
            const rawCost = row.Cost || row.cost || row.Price || row.price || row["Unit Price"] || row["unit price"] || row["Unit Cost"] || row["unit cost"];
            
            batch.set(newDocRef, {
              name: row.Name || row.name || "Unknown Item",
              category: row.Category || row.category || "Supplies",
              stockCount: Number(row.Stock || row.stock || row.stockCount || row.Quantity || row.quantity) || 0,
              unit: row.Unit || row.unit || "units",
              threshold: Number(row.Threshold || row.threshold) || 5,
              unitCost: Number(parseFloat(String(rawCost).replace(/[^0-9.-]+/g,"")).toFixed(2)) || 0
            });
          });

          await batch.commit();
          alert(`Successfully imported ${results.data.length} items!`);
          fetchInventory(); 
          
        } catch (error) {
          console.error("Error importing batch:", error);
          alert("There was an error importing the CSV.");
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = ""; 
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        alert("Failed to read the CSV file.");
        setIsImporting(false);
      }
    });
  };

  const currentInventoryValue = inventory.reduce((sum, item) => sum + (item.stockCount * (item.unitCost || 0)), 0);

  if (isLoading) return <div className="p-8">Loading inventory...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 mt-2">Track stock levels, manage supplies, and monitor capital.</p>
        </div>
        
        <div className="flex gap-3">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
          
          <button onClick={() => fileInputRef.current?.click()} disabled={isImporting || isClearing} className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
            {isImporting ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> : <UploadCloud size={20} />}
            Import Order CSV
          </button>

          <button onClick={() => setShowAddForm(!showAddForm)} disabled={isClearing} className="flex items-center gap-2 bg-[#005088] hover:bg-[#003f6b] text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
            {showAddForm ? "Cancel" : <><PlusCircle size={20} /> Add New Item</>}
          </button>
        </div>
      </div>

      <div className="mb-8 bg-gradient-to-r from-[#005088] to-[#11CAA0] rounded-xl shadow-md p-6 text-white flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-white/80 uppercase tracking-wider">Current Inventory Value</h2>
          <div className="text-4xl font-bold mt-1">${currentInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div className="hidden sm:block opacity-20"><DollarSign size={64} /></div>
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-xl border border-[#005088] shadow-md mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Add Inventory Item</h2>
          <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
              <input required type="text" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#005088] outline-none" placeholder="e.g., Sirloin Steak (8oz)" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white">
                <option value="Food">Food</option>
                <option value="Alcohol">Alcohol</option>
                <option value="Beverage">Beverage</option>
                <option value="Supplies">Supplies</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price ($)</label>
              <input required type="number" step="0.01" min="0" value={newItem.unitCost} onChange={e => setNewItem({...newItem, unitCost: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Type</label>
              <select value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white">
                <option value="units">Units</option>
                <option value="lbs">Lbs</option>
                <option value="cases">Cases</option>
                <option value="kegs">Kegs</option>
                <option value="bottles">Bottles</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alert Threshold</label>
              <input required type="number" min="0" value={newItem.threshold} onChange={e => setNewItem({...newItem, threshold: Number(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="md:col-span-6 flex justify-end mt-2">
              <button type="submit" className="bg-[#11CAA0] hover:bg-teal-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                Save Item
              </button>
            </div>
          </form>
        </div>
      )}

      {/* NEW: Added overflow-x-auto wrapper and min-w-[900px] to the table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-600 whitespace-nowrap">
                <th className="p-4">Item Name</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-center">Unit Price</th>
                <th className="p-4 text-center">Stock Level</th>
                <th className="p-4 text-center">Total Cost</th> 
                <th className="p-4 text-center">Quick Adjust</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inventory.map((item) => {
                const is86 = item.stockCount === 0;
                const isLow = item.stockCount > 0 && item.stockCount <= item.threshold;
                const totalItemCost = item.stockCount * (item.unitCost || 0);

                return (
                  <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${is86 ? 'bg-red-50/50' : ''}`}>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Package size={18} className="text-gray-400 flex-shrink-0" />
                        <span className={`font-semibold ${is86 ? 'text-red-700 line-through opacity-70' : 'text-gray-900'}`}>{item.name}</span>
                        {is86 && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">86'D</span>}
                        {isLow && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 flex items-center gap-1"><AlertTriangle size={10}/> LOW</span>}
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md">{item.category}</span>
                    </td>
                    <td className="p-4 text-center text-sm font-medium text-gray-600 whitespace-nowrap">
                      ${Number(item.unitCost || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center">
                        <span className={`text-xl font-bold ${is86 ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-gray-900'}`}>{item.stockCount}</span>
                        <span className="text-xs text-gray-500 uppercase">{item.unit}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center font-bold text-gray-900 whitespace-nowrap">
                      ${totalItemCost.toFixed(2)}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={() => handleAdjustStock(item.id, item.stockCount, -1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"><Minus size={16} /></button>
                        <button onClick={() => handleAdjustStock(item.id, item.stockCount, 1)} className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"><Plus size={16} /></button>
                      </div>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                );
              })}
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-gray-500">
                    <Package size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-lg font-medium text-gray-900">Your inventory is empty.</p>
                    <p>Click "Add New Item" or import an order CSV to start tracking your stock.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {inventory.length > 0 && (
        <div className="flex justify-end border-t border-gray-200 pt-6">
          <button 
            onClick={handleClearInventory}
            disabled={isClearing || isImporting}
            className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-50 shadow-sm"
          >
            {isClearing ? (
              <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 size={20} />
            )}
            Clear Entire Inventory
          </button>
        </div>
      )}
    </div>
  );
}