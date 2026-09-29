// Standalone version of Module 1. Same logic as AdminApplication.
// prompt()/alert()/DOM are replaced by parameters and return values so it can run anywhere.
class StockInventory {
  constructor(logAudit, broadcastWsEvent) {
    this.logAudit = logAudit || ((sev, actor, mod, action) => console.log('[AUDIT]', sev, actor, mod, action));
    this.broadcastWsEvent = broadcastWsEvent || ((tag, msg) => console.log(`[WS] <${tag}>`, msg));

    // In-memory array of objects (no database)
    this.paperInventory = [
      { id: 'paper-3r-solo',   name: '3R Solo Photo Paper (3.5" x 5")',            usedFor: 'SOLO 199, SOLO 249', units: 420, unitType: 'sheets', packaging: '4 sealed boxes (100s) + 20 loose', reorderLevel: 150, status: 'In Stock' },
      { id: 'paper-3r-strip',  name: '3R Photo Strip Paper (2" x 6" dual strips)', usedFor: 'DUO 249, TRIO 349, GRUPO 449, RENT DUO 799, RENT GRUPO 1199', units: 650, unitType: 'strips', packaging: '6 sealed packs (100s) + 50 loose', reorderLevel: 200, status: 'In Stock' },
      { id: 'paper-4r-strip',  name: '4R Photo Strip Paper (4" x 6" cut strips)',  usedFor: 'DUO 399, TRIO 499, GRUPO 599, RENT DUO 799, RENT GRUPO 1199', units: 180, unitType: 'strips', packaging: '1 sealed box (100s) + 80 loose', reorderLevel: 200, status: 'Low Stock' },
      { id: 'paper-3r-quadro', name: '3R Quadro Grid Photo Paper (3.5" x 5" 4-up)', usedFor: 'SOLO 249', units: 310, unitType: 'sheets', packaging: '3 sealed packs (100s) + 10 loose', reorderLevel: 100, status: 'In Stock' }
    ];

    this.inkInventory = [
      { id: 'ribbon-dnp-rx1', name: 'DNP DS-RX1HS Dye-Sublimation Color Ribbon', colorType: '4-Pass YMC + Overcoat Gloss Roll', yieldPerUnit: '700 prints / roll', stockRemaining: '3 mounted rolls + 2 spares', level: 75, healthStatus: 'Optimal' },
      { id: 'clean-kit-rx1',  name: 'Thermal Print Head Cleaning Kits', colorType: 'Isopropyl Head Cleaning Sheet + Pen', yieldPerUnit: '50 cleaning passes / kit', stockRemaining: '4 sealed kits', level: 100, healthStatus: 'Good' },
      { id: 'waste-box-dnp',  name: 'Printer Scrap Paper & Ribbon Waste Collector', colorType: 'Polycarbonate Catch Tray', yieldPerUnit: '1,400 strip cuts capacity', stockRemaining: '3 active units (1 per branch)', level: 35, healthStatus: 'Clean' },
      { id: 'head-dnp-spare', name: 'DNP High-Density 300 DPI Thermal Print Head (Spare)', colorType: 'Solid-State Ceramic Thermal Array', yieldPerUnit: '~50,000 prints lifespan', stockRemaining: '2 factory backup heads', level: 100, healthStatus: 'Certified Functional' }
    ];
  }

  // Iteration with map(): one row string per record
  renderPaperInventoryTable() {
    return this.paperInventory.map(item => `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td>${item.usedFor}</td>
        <td>${item.units} ${item.unitType}</td>
        <td>${item.packaging}</td>
        <td>&lt; ${item.reorderLevel} ${item.unitType}</td>
        <td><span class="badge ${item.status === 'In Stock' ? 'badge-confirmed' : 'badge-danger'}">${item.status}</span></td>
      </tr>`).join('');
  }

  renderInkInventoryTable() {
    const healthy = ['Optimal', 'Good', 'Clean', 'Certified Functional'];
    return this.inkInventory.map(item => `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td>${item.colorType}</td>
        <td>${item.yieldPerUnit}</td>
        <td>${item.stockRemaining}</td>
        <td>${item.level}% (bar: ${item.level > 50 ? 'green' : item.level > 20 ? 'yellow' : 'red'})</td>
        <td><span class="badge ${healthy.includes(item.healthStatus) ? 'badge-confirmed' : 'badge-danger'}">${item.healthStatus}</span></td>
      </tr>`).join('');
  }

  // countStr = value typed in the prompt (null = user cancelled)
  adjustPaperStock(id, countStr) {
    const item = this.paperInventory.find(p => p.id === id);        // Linear Search
    if (!item) return null;
    if (countStr === null) return null;

    const count = parseInt(countStr, 10);
    if (isNaN(count) || count < 0) {
      return { ok: false, message: 'Please enter a valid numeric value.' };
    }

    const diff = count - item.units;
    item.units = count;
    item.status = count < item.reorderLevel ? 'Low Stock' : 'In Stock';

    this.logAudit('INFO', 'Admin Desk', 'Storage Inventory',
      `Adjusted ${item.name} stock to ${count} ${item.unitType} (${diff >= 0 ? '+' : ''}${diff})`);
    this.broadcastWsEvent('INVENTORY_UPDATE',
      `Photo paper updated: ${item.name} is now ${count} ${item.unitType} (${item.status})`);

    return { ok: true, item, tableHtml: this.renderPaperInventoryTable() };
  }

  adjustInkStock(id, levelStr) {
    const item = this.inkInventory.find(i => i.id === id);         // Linear Search
    if (!item) return null;
    if (levelStr === null) return null;

    const lvl = parseInt(levelStr, 10);
    if (isNaN(lvl) || lvl < 0 || lvl > 100) {
      return { ok: false, message: 'Please enter a percentage between 0 and 100.' };
    }

    item.level = lvl;
    if (lvl < 20) item.healthStatus = 'Replace Soon';
    else if (lvl < 50) item.healthStatus = 'Operational';
    else item.healthStatus = 'Optimal';

    this.logAudit('INFO', 'Admin Desk', 'Printer Consumables',
      `Updated ${item.name} operational level to ${lvl}% (${item.healthStatus})`);
    this.broadcastWsEvent('INVENTORY_UPDATE',
      `Ink consumable updated: ${item.name} level set to ${lvl}%`);

    return { ok: true, item, tableHtml: this.renderInkInventoryTable() };
  }

  // Original behavior: logs + broadcasts only. It does NOT change any stock quantity.
  openResourceRestockModal(itemName, qty) {
    if (itemName && qty) {
      this.logAudit('INFO', 'Admin Desk', 'Storage Restock', `Restock shipment received: ${qty} units of ${itemName}`);
      this.broadcastWsEvent('RESTOCK_RECEIVED', `Restock received: ${qty} units of ${itemName} logged into Bulacan central storage.`);
      return true;
    }
    return false;
  }
}

// Demo
const inv = new StockInventory();
console.log(inv.adjustPaperStock('paper-4r-strip', '250').item.status); // "In Stock"
console.log(inv.adjustPaperStock('paper-3r-solo', '100').item.status);  // "Low Stock"
console.log(inv.adjustInkStock('waste-box-dnp', '15').item.healthStatus); // "Replace Soon"
