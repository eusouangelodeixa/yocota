export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground">Esta funcionalidade será implementada nas próximas fases.</p>
      </div>
    </div>
  );
}
