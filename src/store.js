const fs = require("fs/promises");
const path = require("path");

function cloneRecord(record) {
  return { ...record };
}

class QrStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.records = new Map();
    this.writeQueue = Promise.resolve();
    this.isReady = false;
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      const fileContent = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(fileContent);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.slug === "string") {
            this.records.set(item.slug, cloneRecord(item));
          }
        }
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    this.isReady = true;
  }

  ensureReady() {
    if (!this.isReady) {
      throw new Error("Store not initialized");
    }
  }

  async persist() {
    this.ensureReady();
    const data = JSON.stringify(this.list(), null, 2);
    const tmpPath = `${this.filePath}.tmp`;

    this.writeQueue = this.writeQueue.then(async () => {
      await fs.writeFile(tmpPath, data, "utf8");
      await fs.rename(tmpPath, this.filePath);
    });

    return this.writeQueue;
  }

  list(search) {
    this.ensureReady();
    let values = Array.from(this.records.values()).map(cloneRecord);

    if (typeof search === "string" && search.trim().length > 0) {
      const term = search.trim().toLowerCase();
      values = values.filter((record) => {
        const slugMatch = record.slug.toLowerCase().includes(term);
        const nameMatch =
          typeof record.name === "string" &&
          record.name.toLowerCase().includes(term);
        return slugMatch || nameMatch;
      });
    }

    values.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return values;
  }

  getBySlug(slug) {
    this.ensureReady();
    const record = this.records.get(slug);
    return record ? cloneRecord(record) : null;
  }

  async create({ slug, destinationUrl, name }) {
    this.ensureReady();
    if (this.records.has(slug)) {
      const conflict = new Error("Slug already exists");
      conflict.code = "CONFLICT";
      throw conflict;
    }

    const now = new Date().toISOString();
    const record = {
      slug,
      destinationUrl,
      name: typeof name === "string" && name.trim().length > 0 ? name.trim() : null,
      isActive: true,
      totalClicks: 0,
      lastClickAt: null,
      createdAt: now,
      updatedAt: now
    };

    this.records.set(slug, record);
    await this.persist();
    return cloneRecord(record);
  }

  async update(slug, patch) {
    this.ensureReady();
    const current = this.records.get(slug);
    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.records.set(slug, updated);
    await this.persist();
    return cloneRecord(updated);
  }

  async setActive(slug, isActive) {
    return this.update(slug, { isActive });
  }

  async trackClick(slug) {
    this.ensureReady();
    const current = this.records.get(slug);
    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      totalClicks: Number(current.totalClicks || 0) + 1,
      lastClickAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.records.set(slug, updated);
    await this.persist();
    return cloneRecord(updated);
  }
}

module.exports = {
  QrStore
};
