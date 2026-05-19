import {
  Archive,
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowDown,
  ArrowLineDown,
  ArrowLineUp,
  ArrowUp,
  At,
  Bell,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChatCircle,
  Check,
  Cloud,
  CloudArrowDown,
  CloudArrowUp,
  Eye,
  File as PhFile,
  Folder,
  Gear,
  GitBranch,
  GitCommit,
  ClockCounterClockwise,
  Keyboard,
  ListBullets,
  ListDashes,
  MagnifyingGlass,
  Minus,
  Monitor,
  Pencil,
  Plus,
  Robot,
  Rows,
  Sidebar,
  SortAscending,
  Sparkle,
  SquareSplitHorizontal,
  Terminal,
  TextAUnderline,
  Trash,
  Tree,
  TreeStructure,
  User,
  X,
} from "@phosphor-icons/react";

type Props = { size?: number; weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"; className?: string; style?: React.CSSProperties };

const make = (Phosphor: React.ElementType) =>
  function PhIcon({ size = 16, weight = "regular", className, style }: Props) {
    return <Phosphor size={size} weight={weight} className={className} style={style} />;
  };

export const IconArrowCounterclockwise = make(ArrowCounterClockwise);
export const IconArrowClockwise = make(ArrowClockwise);
export const IconCloudArrowDown = make(CloudArrowDown);
export const IconCloudArrowUp = make(CloudArrowUp);
export const IconArchiveDown = make(ArrowLineDown);
export const IconArchiveUp = make(ArrowLineUp);
export const IconArchive = make(Archive);
export const IconBranch = make(GitBranch);
export const IconTerminal = make(Terminal);
export const IconSearch = make(MagnifyingGlass);
export const IconBell = make(Bell);
export const IconGear = make(Gear);
export const IconUser = make(User);
export const IconCaretDown = make(CaretDown);
export const IconCaretUp = make(CaretUp);
export const IconCaretLeft = make(CaretLeft);
export const IconCaretRight = make(CaretRight);
export const IconChevronDown = make(CaretDown);
export const IconChevronUp = make(CaretUp);
export const IconChevronLeft = make(CaretLeft);
export const IconChevronRight = make(CaretRight);
export const IconX = make(X);
export const IconMonitor = make(Monitor);
export const IconSidebar = make(Sidebar);
export const IconCommit = make(GitCommit);
export const IconCheck = make(Check);
export const IconPlus = make(Plus);
export const IconMinus = make(Minus);
export const IconPencil = make(Pencil);
export const IconRename = make(TextAUnderline);
export const IconFolder = make(Folder);
export const IconCloud = make(Cloud);
export const IconTrash = make(Trash);
export const IconSort = make(SortAscending);
export const IconList = make(ListBullets);
export const IconPath = make(ListDashes);
export const IconTree = make(Tree);
export const IconTreeStructure = make(TreeStructure);
export const IconSparkle = make(Sparkle);
export const IconSplit = make(SquareSplitHorizontal);
export const IconInline = make(Rows);
export const IconWrap = make(TextAUnderline);
export const IconHistory = make(ClockCounterClockwise);
export const IconEye = make(Eye);
export const IconArrowUp = make(ArrowUp);
export const IconArrowDown = make(ArrowDown);
export const IconRobot = make(Robot);
export const IconChat = make(ChatCircle);
export const IconAt = make(At);
export const IconKeyboard = make(Keyboard);
export const IconFile = make(PhFile);
