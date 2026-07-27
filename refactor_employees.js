const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/(app)/employees/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 0. Remove AvatarUpload
content = content.replace(/import \{ AvatarUpload \} from "@\/components\/employees\/AvatarUpload";\n/g, '');

// 1. Update imports
content = content.replace(
  /import \{ ScrollReveal \} from "@\/components\/ui\/ScrollReveal";\s+import \{\s+subscribeToDevelopers,\s+addDeveloper,\s+updateDeveloper,\s+deleteDeveloper,\s+type NewEmployee,\s+\} from "@\/lib\/data\/developers";/g,
  `import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { AddEmployeeForm } from "@/components/employees/AddEmployeeForm";
import { EmployeeCard } from "@/components/employees/EmployeeCard";
import { EditEmployeeDialog } from "@/components/employees/EditEmployeeDialog";
import {
  subscribeToDevelopers,
  addDeveloper,
  deleteDeveloper,
} from "@/lib/data/developers";`
);

// 2. Remove EMPTY constant
content = content.replace(/const EMPTY: NewEmployee[\s\S]*?accessLevel: "employee",\r?\n\};\r?\n/g, '');

// 3. Remove unused state
content = content.replace(/  const \[form, setForm\] = useState<NewEmployee>\(EMPTY\);\r?\n  const \[saving, setSaving\] = useState\(false\);\r?\n/g, '');

// 4. Remove `add` function
content = content.replace(/  async function add\(\) \{[\s\S]*?    \} finally \{\r?\n      setSaving\(false\);\r?\n    \}\r?\n  \}\r?\n/g, '');

// 5. Replace AddEmployeeForm chunk
content = content.replace(
  /<Paper elevation=\{3\} sx=\{\{ p: 4, borderRadius: 4, bgcolor: "background\.paper"[\s\S]*?<\/Paper>/g,
  '<AddEmployeeForm employees={employees} onAdd={addDeveloper} />'
);

// 6. Replace EmployeeCard chunk
content = content.replace(
  /                  <Paper \r?\n                    elevation=\{1\} [\s\S]*?                  <\/Paper>/g,
  '                  <EmployeeCard employee={e} onEdit={() => setEditForm(e)} />'
);

// 7. Replace EditEmployeeDialog chunk
content = content.replace(
  /      <Dialog \r?\n        open=\{\!\!editForm\} [\s\S]*?      <\/Dialog>/g,
  '      <EditEmployeeDialog developer={editForm} onClose={() => setEditForm(null)} onRemove={(dev) => setDeveloperToDelete(dev)} />'
);

// 8. Remove Field and CardRow functions at the bottom
content = content.replace(/function Field\(\{ label, children \}: \{ label: string; children: React\.ReactNode \}\) \{[\s\S]*?  \);\r?\n\}\r?\n/g, '');
content = content.replace(/function CardRow\(\{ label, children \}: \{ label: string; children: React\.ReactNode \}\) \{[\s\S]*?  \);\r?\n\}\r?\n/g, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Refactored page.tsx');
